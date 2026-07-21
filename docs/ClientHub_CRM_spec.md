# ClientHub — CRM + Activity Tracker (Spec for Claude Code)

> Paste this file into your project folder and tell Claude Code:
> "Read ClientHub_CRM_spec.md and implement Phase 1. Ask me clarifying questions before writing code."

## 1. Vision

One app that is BOTH a CRM and an operational activity tracker. It is not just for sales — it manages clients, recurring contracts, internal projects (websites, video content, courses, campaigns), and team coordination. The core problem it solves: existing tools (Notion, Basecamp, Fizzy) store information well but don't pull the user back daily. This app must create a **daily check-in habit**.

**Primary user:** solo consultant / small team (invataexcel.ro, lucreazacuai.ro, funnels.ro).
**Secondary goal:** architecture clean enough to later sell as multi-tenant SaaS to Romanian SMEs.

## 2. Tech stack — SAME AS ADPROFIT

Use the exact stack and conventions already validated in the AdProfit project (reference: `AdProfit — Architecture & User Guide`). Tell Claude Code: "Follow the same architecture conventions as AdProfit."

- **Frontend:** Next.js App Router + React + TypeScript (strict). Server Components for data fetching, Client Components only for interactive UI.
- **Styling:** Tailwind CSS — background `#f4f5f7`, white cards, one accent color (pick a different accent than AdProfit's indigo, e.g. emerald, so the apps are visually distinguishable).
- **DB:** Supabase Postgres, single schema, every row scoped to workspace/org.
- **Auth:** Supabase Auth (email/password), HTTP-only Secure session cookies, `createSupabaseServerClient()` pattern for all Server Components and Route Handlers.
- **File storage:** Supabase Storage (client documents).
- **AI:** Anthropic API — `claude-haiku-4-5` streaming via SSE for routine analysis; use `claude-sonnet` only for the per-client Q&A chat where quality matters more.
- **Charts:** Recharts.
- **Deploy:** Vercel. Note: Vercel Hobby prohibits commercial use — move to Pro before selling access.

### 2.1 Architecture conventions inherited from AdProfit (MANDATORY)

1. **RLS everywhere:** every table has Row Level Security enabled. Policies call a Postgres function `get_user_workspace_ids()` that returns only the workspaces the user belongs to. No table without a policy.
2. **Server-side auth only:** all data fetching happens in Server Components or Route Handlers using the server Supabase client. The service role key is never exposed to the browser.
3. **Team invites:** admin generates a UUID-token invite link; recipient clicks, signs up/logs in, and is added to the workspace. Reuse AdProfit's flow.
4. **Settings as KV store:** per-workspace `settings` table with `key` / `value` (text, JSON where needed) — configurable statuses, activity types, thresholds live here or in dedicated config tables; either way, no schema change needed to add options.
5. **AI rate limiting:** atomic Postgres RPC (pattern: `increment_ai_analysis_count`) enforced per workspace per day, checked server-side in the Route Handler before calling the API. Log usage to an `ai_analysis_log` table (`created_at`, `prompt_tokens`, `completion_tokens`).
6. **Plan enforcement server-side:** limits (members, AI calls) checked in Route Handlers — never client-side only.
7. **Cron jobs:** Vercel cron (daily) for the digest email and any recomputation jobs; all jobs idempotent (safe to re-run), upserts keyed on natural unique keys.
8. **Secrets/tokens** (Gmail OAuth tokens in Phase 2/3): stored server-side in DB, encrypted, never returned to the browser — same as AdProfit's Meta token handling, including an expiry alert pattern (email the user before a connected account's token expires).
9. **Sensitive external webhooks** (Stripe later): signature-verified before processing.
10. **No user-generated HTML rendered as markup** (XSS): comments and notes rendered as plain text / sanitized markdown.

### 2.2 Integration with AdProfit (personal dashboard)

For Adrian's own workspace: a read-only "Financiar" card on the "Azi" dashboard pulling headline numbers (profit period-to-date, spend, revenue) from the AdProfit Supabase project via a small server-side query or a lightweight JSON endpoint exposed by AdProfit. Read-only, no codebase merge, feature-flagged so it's absent for other tenants.

## 3. Multi-tenancy model

```
Organization (tenant)
 └── Workspace (e.g. "invataexcel", "lucreazacuai", "funnels")
      └── Team members (role: admin | member)
           └── Entities: Clients, Projects, Activities, Tasks
```

- Row-level security by `organization_id`.
- Workspaces separate lines of business but share the same team pool.
- Settings (statuses, pipelines, activity types) are configured **per workspace**.

## 4. Core data model

### clients
- id, workspace_id, name, company_name, contact_person
- phone, email, whatsapp, instagram, facebook, linkedin (all optional)
- source (how acquired), tags[]
- current_status_id (FK → statuses)
- date_added, date_first_contacted
- estimated_value, currency (RON default)
- owner_user_id (responsible team member)
- next_step_date, next_step_description
- ai_summary (cached), ai_summary_updated_at

### statuses (configurable in Settings, per workspace)
- id, workspace_id, name, color, order
- phase: `pre_sale` | `post_sale` (statuses before winning the client AND after: e.g. Lead → Contacted → Oferta trimisă → Follow-up → Contract semnat → Activ → Recurent → Inactiv → Pierdut)
- is_won / is_lost flags (for conversion metrics)

### status_history
- id, client_id, from_status_id, to_status_id, changed_by, changed_at, note
- Used to compute **days in each status** and full timeline ("oferta trimisă pe X, follow-up pe Y, contract pe Z").

### activities (the heart of the app)
- id, workspace_id, client_id (nullable!), project_id (nullable)
- type: call | email | whatsapp | meeting | task | note | filming | editing | campaign | newsletter | other (configurable list)
- title, description, status (todo | in_progress | done | waiting_client)
- assigned_to, created_by
- due_date, done_date
- waiting_on: `me` | `client` — critical for follow-up logic
- Handoff: reassigning creates a log entry + notification for the receiving member

### projects (non-client work)
- id, workspace_id, name, type (website | video | course | campaign | internal), status, description
- Everything that has activities but no client: filming, courses in production, landing pages, new business lines.

### comments
- id, parent_type (client | project | activity), parent_id, user_id, text, created_at
- Full history, never overwritten. AI analyses can be saved here with flag `is_ai = true`.

### documents
- id, parent_type, parent_id, filename, storage_path, uploaded_by, uploaded_at

### interactions (communication log)
- id, client_id, channel (email | whatsapp | phone | instagram | facebook | linkedin | in_person)
- direction (in | out), occurred_at, summary, raw_content (nullable), external_ref
- Phase 1: logged manually or semi-automatically. Phase 3: synced automatically.

## 5. Duplicate detection

On client create/edit: fuzzy match on email (exact), phone (normalized), and name (trigram similarity). Show a warning panel "Posibil duplicat" with merge option (merge keeps all history, comments, documents).

## 6. Dashboard (the daily habit engine)

The dashboard opens on **"Azi" (Today)** — this is the retention mechanism:

1. **Azi / Săptămâna asta:** activities due today, overdue (red), and due in the next 7 days; follow-ups whose next_step_date passed; clients "waiting on me" vs "waiting on client" (with days counter).
2. **Outstanding:** anything overdue, sorted by days overdue. This list should be uncomfortable to ignore.
3. **Pipeline:** clients per status — count + total estimated value per column (funnel view). Click-through to filtered list.
4. **KPIs:** total clients, active opportunities, won, lost, conversion rate, oferte trimise (period), contracte semnate, follow-ups depășite, valoare totală oferte / oferte active / contracte câștigate.
5. **Team performance:** per member — active clients, won, lost, activities completed this week, overdue count.
6. **Streak / momentum widget:** consecutive days with at least one completed activity or check-in. Small gamification, big habit effect.

Daily digest email (optional, per user, sent 8:00): "3 follow-ups azi, 2 taskuri overdue, 1 client așteaptă răspuns de 5 zile."

## 7. AI features (Anthropic API)

Follow AdProfit's AI plumbing exactly: rate check via atomic RPC → build structured context server-side → stream via SSE, rendered token by token. Usage logged to `ai_analysis_log`.

1. **Per-client analysis:** button "Analizează clientul" → sends all client data (status history, comments, interactions, activities) to Claude (claude-haiku-4-5, streaming) → returns: situation summary, risks, recommended next steps. Result saved as AI comment with timestamp.
2. **Per-client chat:** "Întreabă despre acest client" — free-form Q&A grounded in the client's full history (claude-sonnet; just concatenate the client's records into context — no vector DB needed initially).
3. **Portfolio analysis:** weekly "Top oportunități" — Claude ranks clients by likelihood/value using status age, interaction recency, value. Shown on dashboard. Run via the daily cron, cached, so it costs one AI call per day, not per page view.
4. Keep prompts in a `/prompts` folder as versioned text files.

## 8. Communication integrations — phased reality

**Phase 1 (ship this):**
- `mailto:` and `https://wa.me/<phone>` deep-link buttons on every client (opens email client / WhatsApp with context).
- "Log interaction" quick form (channel, direction, summary) — 10 seconds to log a call.
- Email forwarding: unique address per workspace (e.g. via Postmark/Resend inbound) — forward/BCC any email and it attaches to the client by matching sender/recipient address.

**Phase 2:**
- Gmail integration per team member (OAuth, Gmail API): pull emails matching client addresses into the client timeline; send from app. Recommendation: **each member connects their own mailbox** + optionally one shared generic mailbox (office@) connected at workspace level. Both, not either/or.

**Phase 3 (only if truly needed):**
- WhatsApp Business Cloud API (Meta): requires WABA, phone number dedicated to the business, per-conversation costs. Personal WhatsApp cannot be legally/reliably integrated — the wa.me + manual log path covers 90% of the value.
- Instagram/Facebook/LinkedIn DMs: Meta app review needed; LinkedIn has no practical DM API. Keep as profile links + manual logging.

## 9. Build phases for Claude Code

- **Phase 1 (MVP, use it yourself in week 1):** auth, single org, workspaces, clients CRUD, configurable statuses, status history, activities + projects, comments, documents, duplicate check, dashboard "Azi" + pipeline + KPIs, deep-link contact buttons, manual interaction log.
- **Phase 2:** AI analysis + per-client chat, daily digest email, team performance, handoff notifications, streaks.
- **Phase 3:** Gmail sync, inbound email address, portfolio AI ranking.
- **Phase 4:** true multi-tenant onboarding (self-serve signup, billing), WhatsApp Business API.

## 10. UX principles

- Romanian UI labels, diacritics correct.
- Everything reachable in ≤2 clicks from dashboard.
- Quick-add (global "+" with keyboard shortcut) for activity/client/note.
- Mobile-responsive — logging a call from the phone must be trivial.
- Empty states that tell you what to do next, not blank screens.
