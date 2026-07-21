# CONVENTIONS.md — AdProfit

Documentație a pattern-urilor de arhitectură folosite în acest proiect (Next.js 16 App Router + Supabase). Scop: orice contribuitor nou (uman sau AI) trebuie să poată respecta aceste convenții fără să re-descopere codul existent.

---

## 1. Izolare multi-tenant prin RLS — `get_user_workspace_ids()`

Fiecare rând din bază aparține unui **workspace**. Row Level Security (RLS) este activ pe toate tabelele, iar politicile RLS filtrează prin funcția Postgres `get_user_workspace_ids()`, care returnează doar workspace-urile din care face parte userul curent.

> **Sursa de adevăr**: definiția funcției `get_user_workspace_ids()`, toate politicile RLS și RPC-ul `increment_ai_analysis_count` sunt versionate în `supabase/migrations/` (vezi secțiunea 7). Producția rulează deja acest schema; fișierele sunt baseline-ul pentru medii noi + ancora pentru migrări viitoare.

**Convenție de încredere**: codul aplicației *nu* re-verifică apartenența la workspace prin query-uri suplimentare — se bazează pe RLS ca graniță reală de securitate. Exemplu explicit în `lib/workspace.ts`:

```ts
export async function getWorkspaceId(supabase: Db): Promise<string | null> {
  const cookieStore = await cookies()
  const activeId = cookieStore.get('active_workspace_id')?.value

  // Trust the cookie — RLS on every table enforces actual membership.
  // A forged cookie just returns empty data; the verification query is redundant.
  if (activeId) return activeId

  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.workspace_id ?? null
}
```

Excepție: route handler-ele care fac o schimbare de stare sensibilă (ex. `workspace/switch`) *totuși* re-verifică apartenența explicit înainte de a seta cookie-ul — vezi secțiunea 8.

---

## 2. Clienți Supabase — trei variante, trei scopuri

| Fișier | Funcție | Context | RLS |
|---|---|---|---|
| `lib/supabase.ts` | `supabase` (export direct) | Client Components (`'use client'`) | Da, scoped la sesiunea userului |
| `lib/supabase-server.ts` | `createSupabaseServerClient()` | Server Components, route handlers normale | Da, scoped la sesiunea userului |
| `lib/supabase-admin.ts` | `createSupabaseAdminClient()` | Doar operații privilegiate (ex. verificare allowlist la signup, înainte de a exista o sesiune) | **Nu** — bypass RLS via service role key |

```ts
// lib/supabase.ts — browser client
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

```ts
// lib/supabase-server.ts — server client (Server Components / route handlers)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies can't be set, session refresh handled by middleware
          }
        },
      },
    }
  )
}
```

```ts
// lib/supabase-admin.ts — service-role client, bypasses RLS
import { createClient } from '@supabase/supabase-js'

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
```

**Regulă**: foloseşte admin client-ul *doar* când RLS trebuie ocolit intenționat (ex. verificarea `allowed_emails`/`workspace_invites` la signup, unde nu există încă sesiune). Niciodată expus către browser.

---

## 3. `settings` ca KV store per-workspace

Tabela `settings` e un magazin cheie/valoare simplu (`key text`, `value text`), scoped per workspace prin RLS. Nu se adaugă coloane noi pentru fiecare setare — se adaugă o nouă pereche `key`/`value`.

```ts
// lib/config.ts
type Settings = {
  vatRate: number
  currency: string
  mode: 'sales' | 'lead_gen'
  rawCategories: string | null
}

const SETTINGS_KEYS = ['vat_rate', 'currency', 'business_mode', 'revenue_categories']

// Single query for all settings — call this instead of the individual helpers.
export async function getAllSettings(supabase: Db): Promise<Settings> {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', SETTINGS_KEYS)

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value

  return {
    vatRate: map.vat_rate ? parseFloat(map.vat_rate) : 0.21,
    currency: map.currency ?? 'RON',
    mode: map.business_mode === 'lead_gen' ? 'lead_gen' : 'sales',
    rawCategories: map.revenue_categories ?? null,
  }
}
```

Există și helper-e legacy per-cheie (`getVatRate`, `getCurrency`, `getBusinessMode`, `getRevenueCategories`) — marcate explicit ca legacy în cod, păstrate doar pentru call site-uri nemigrate încă. **Cod nou → folosește `getAllSettings`**, nu adăuga alte query-uri single-key.

Pentru o setare nouă: adaugă cheia în `SETTINGS_KEYS`, adaugă câmpul corespunzător în tipul `Settings`, mapează-l în `getAllSettings`.

---

## 4. Rate limiting AI prin RPC atomic

Limitele zilnice sunt per-plan (`solo: 3, pro: 10, agency: 100`) și sunt aplicate atomic printr-un RPC Postgres (`increment_ai_analysis_count`) — evită race condition-uri la request-uri concurente pe același workspace.

```ts
// app/api/ai-analysis/route.ts
const DAILY_LIMITS: Record<string, number> = { solo: 3, pro: 10, agency: 100 }

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const workspaceId = await getWorkspaceId(supabase)
  if (!workspaceId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]
  const { data: workspace } = await supabase
    .from('workspaces').select('plan').eq('id', workspaceId).maybeSingle()

  const plan = workspace?.plan ?? 'solo'
  const dailyLimit = DAILY_LIMITS[plan] ?? 3

  // Atomic increment using a Postgres function to avoid race conditions.
  // ai_analysis_count resets to 1 when the stored date differs from today.
  const { data: counterData, error: counterError } = await supabase.rpc(
    'increment_ai_analysis_count',
    { p_workspace_id: workspaceId, p_today: today, p_limit: dailyLimit }
  )

  if (counterError) {
    console.error('AI rate limit RPC error:', counterError.message)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }

  // RPC returns the new count, or -1 if limit exceeded
  if (counterData === -1) {
    return Response.json(
      { error: `Daily limit of ${dailyLimit} analyses reached on your ${plan} plan. Resets at midnight.` },
      { status: 429 }
    )
  }
  // ... construiește prompt-ul din metrici, streamuiește răspunsul Anthropic
}
```

**Convenții RPC**:
- parametrii au prefix `p_` (`p_workspace_id`, `p_today`, `p_limit`)
- RPC-ul returnează noul count, sau sentinela **`-1`** dacă limita e depășită (verificat în TS, nu prin excepție Postgres)
- Model folosit: `claude-haiku-4-5-20251001`, streamed prin `client.messages.stream(...)`.

Orice contor nou care trebuie să fie atomic (nu doar rate limiting AI) → replică acest pattern: funcție RPC Postgres cu parametri `p_*`, returnează valoarea nouă sau `-1`/sentinelă la eșec, verificat explicit în handler.

---

## 5. Structura de foldere

```
app/
  api/
    ai-analysis/route.ts
    auth/signup/route.ts
    cron/
    meta-accounts/
    meta-token/
    report/
    stripe/
    sync/
    webhooks/
    workspace/{invite,list,switch}/route.ts
  auth/{accept-invite,callback,facebook}/
  campaigns/{loading.tsx, page.tsx}
  costs/{loading.tsx, page.tsx}
  login/
  products/{loading.tsx, page.tsx}
  revenue/{loading.tsx, page.tsx}
  settings/{loading.tsx, page.tsx, team/page.tsx}
  loading.tsx, page.tsx        # dashboard-ul principal

components/
  AccountFilter.tsx, AiAnalysis.tsx, CampaignsTable.tsx, CostsClient.tsx,
  DashboardActions.tsx, DateFilter.tsx, LoginForm.tsx, PageSkeleton.tsx,
  ProductFilter.tsx, ProductsClient.tsx, RevenueClient.tsx, SettingsClient.tsx,
  Sidebar.tsx, TeamClient.tsx, TrendChart.tsx, WorkspaceSwitcher.tsx

lib/
  cogs.ts, config.ts, fmt.ts, meta.ts, pdf-report.tsx, revenue-categories.ts,
  supabase-admin.ts, supabase-server.ts, supabase.ts, sync.ts, types.ts, workspace.ts

proxy.ts    # middleware Next.js 16 (vezi secțiunea 9)
```

**Pattern obligatoriu pentru fiecare arie funcțională**: o pereche `app/<zona>/page.tsx` (Server Component async, face fetch de date prin `createSupabaseServerClient()` + `getAllSettings()` + `getWorkspaceId()`, apoi pasează rezultatele ca props) + `components/<Zona>Client.tsx` (Client Component care primește datele ca props și gestionează interacțiunea).

Exemple existente: `revenue/page.tsx` → `RevenueClient.tsx`; `costs/page.tsx` → `CostsClient.tsx`; `products/page.tsx` → `ProductsClient.tsx`; `settings/page.tsx` → `SettingsClient.tsx`; `settings/team/page.tsx` → `TeamClient.tsx`.

Fiecare folder de rută are propriul `loading.tsx` (Suspense fallback afișat instant, în timp ce Server Component-ul aduce datele) — vezi `components/PageSkeleton.tsx` pentru scheletonul reutilizabil.

**Rută nouă → respectă acest pattern**: `page.tsx` server-side + `XClient.tsx` client-side + `loading.tsx`.

---

## 6. Convenții de denumire

| Element | Convenție | Exemple |
|---|---|---|
| Funcții TS | camelCase | `getAllSettings`, `getWorkspaceId`, `createSupabaseServerClient`, `parseCategories`, `exVat` |
| Componente/fișiere React | PascalCase | `RevenueClient.tsx`, `WorkspaceSwitcher.tsx`, `AiAnalysis.tsx` |
| Tabele/coloane DB | snake_case | `workspace_members`, `revenue_entries`, `ad_accounts`, `active_workspace_id`, `meta_campaign_id`, `vat_rate` |
| Coloane boolean | prefix `is_` | `is_catalog` pe `campaigns` — în TS deseori redenumit camelCase local: `const isCatalog = c.is_catalog ?? false` |
| Câmpuri monetare calculate (nu coloane DB) | sufix `_net` / `_gross` | `totalConvValueNet`, `offlineRevenueNet`, `totalRevenueNet`, `totalCostsNet` |
| Parametri RPC | prefix `p_` | `p_workspace_id`, `p_today`, `p_limit` |
| Log-uri în route handlers | tag între paranteze drepte = calea rutei | `console.error('[workspace/list]', err)`, `console.error('[auth/signup]', err)` |

**Notă**: aliasul de tip `Db` (secțiunea 10) e duplicat per-fișier în loc de centralizat în `lib/types.ts` — dacă apar 3+ duplicate noi, mută-l central.

---

## 7. Migrări SQL

Schema e versionată în `supabase/migrations/` (baseline creat 2026-07 ca snapshot al schemei live). Trei fișiere baseline, rulate în ordine:

| Fișier | Conținut |
|---|---|
| `20260710000001_baseline_tables.sql` | extensia `pgcrypto`, 12 tabele, PK-uri, unique, check-uri, FK-uri, indexuri |
| `20260710000002_functions_and_triggers.sql` | `get_user_workspace_ids`, `set_user_id`, `increment_ai_analysis_count`, `claim_unowned_rows` + cele 7 trigger-e `set_user_id` |
| `20260710000003_rls_policies.sql` | `enable row level security` + toate cele 19 politici |

**Ordinea contează**: tabele → funcții/trigger-e → RLS (politicile apelează `get_user_workspace_ids()`; trigger-ele apelează `set_user_id()`).

**Convenție pentru orice schimbare de schemă de-acum înainte**:
1. Fișier nou: `supabase/migrations/<YYYYMMDDHHMMSS>_descriere_scurta.sql`.
2. Idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` înainte de `CREATE POLICY`, `DROP TRIGGER IF EXISTS` înainte de `CREATE TRIGGER`.
3. Orice tabelă nouă → RLS activat + politică ce filtrează prin `get_user_workspace_ids()`, în același fișier de migrare.
4. Aplicare pe un mediu nou: `supabase db push` (sau paste în SQL Editor, în ordine). Nu rula baseline-ul pe producție așteptând schimbări — schema e deja live acolo.

Vezi `supabase/migrations/README.md` pentru detalii + secțiunea "Known issues" (bug latent: PK-ul lui `settings` e pe `key` singur, nu pe `(key, workspace_id)`).

---

## 8. Pattern route handlers (`app/api/*/route.ts`)

```ts
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ... logică specifică, eventual re-verificare explicită de apartenență
    // (ex. workspace/switch verifică workspace_members înainte de a seta cookie-ul)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[nume/ruta]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
```

Puncte cheie:
- **try/catch obligatoriu** la nivelul întregului handler, cu `console.error('[cale/ruta]', err)` și `500` generic — niciodată stack trace expus în răspuns.
- Client: `createSupabaseServerClient()` normal; `createSupabaseAdminClient()` doar unde RLS trebuie ocolit intenționat (pre-auth, ex. `auth/signup`).
- Cod de status convențional: `400` input invalid, `401` neautentificat, `403` interzis (ex. nu ești membru al workspace-ului), `429` rate-limited, `500` eroare server.
- Cookie-uri setate direct pe `NextResponse` cu flag-uri explicite de securitate: `httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: ...`.
- Chiar dacă RLS protejează datele, mutațiile sensibile de stare (schimbare workspace activ) **re-verifică explicit apartenența** înainte de a acționa — nu se bazează doar pe RLS acolo unde consecința unei erori ar fi vizibilă/permanentă (ex. cookie greșit setat).

---

## 9. `proxy.ts` — middleware Next.js 16

⚠️ În Next.js 16, fișierul de middleware se numește **`proxy.ts`** (nu `middleware.ts`), exportă funcția `proxy` (nu `middleware`), plus `config.matcher` ca de obicei. Nu redenumi — build-ul eșuează dacă există ambele fișiere simultan.

```ts
export async function proxy(request: NextRequest) {
  // ... creează supabase server client legat de cookies din request

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Redirect autenticați cu invite în așteptare (doar navigări HTML, nu API/assets)
  if (user && !isAuthRoute) {
    const pendingInvite = request.cookies.get('pending_invite')?.value
    const isNavigation = request.headers.get('accept')?.includes('text/html') ?? false
    if (pendingInvite && isNavigation) {
      return NextResponse.redirect(new URL(`/auth/accept-invite?token=${pendingInvite}`, request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}
```

`config.matcher` exclude explicit `api/webhooks` — endpoint-urile de webhook (ex. Stripe) trebuie să ocolească complet logica de auth/cookie-uri.

---

## 10. Pattern-uri de tipuri

`lib/types.ts` conține tipurile de domeniu/rânduri DB — nume PascalCase, câmpuri snake_case (oglindesc coloanele din DB):

```ts
export type RevenueEntry = {
  id: string
  ad_account_id: string | null
  product_id: string | null
  type: 'online_sale' | 'contract' | 'collaboration' | 'training'
  description: string | null
  amount: number
  date_start: string
  date_end: string
  created_at: string
  updated_at: string
}
```

Separat, `lib/config.ts` și `lib/workspace.ts` declară **fiecare independent** același tip structural minimal, pentru a accepta orice variantă de client Supabase (browser/server/admin) fără a importa tipul generat complet:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }
```

Acest alias e duplicat, nu centralizat — dacă adaugi un al treilea/patrulea loc care are nevoie de el, mută-l în `lib/types.ts` și importă-l de acolo în loc să-l redeclari.

---

## Rezumat rapid — reguli de aur

1. **Nu re-inventa verificarea de workspace** — RLS + `get_user_workspace_ids()` e granița reală; codul de business are voie să aibă încredere în cookie, cu excepția mutațiilor sensibile de stare.
2. **Alege clientul Supabase corect**: browser în Client Components, server în Server Components/route handlers normale, admin doar pre-auth sau bypass intenționat de RLS.
3. **Setare nouă → cheie nouă în `settings`**, nu coloană nouă; extinde `getAllSettings`, nu adăuga query separat.
4. **Contor atomic nou → RPC Postgres** cu parametri `p_*`, returnează valoare sau sentinelă `-1`.
5. **Rută nouă → `page.tsx` (server) + `XClient.tsx` (client) + `loading.tsx`**.
6. **Orice schimbare de schemă → fișier de migrare** în `supabase/migrations/`, idempotent, cu RLS inclus.
7. **Route handler → try/catch + log taguit `[cale/ruta]` + status code convențional**.
8. **Fișierul de middleware e `proxy.ts`**, nu `middleware.ts`.
