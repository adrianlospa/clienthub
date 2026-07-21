/**
 * npm run test:rls
 *
 * Verifică efectiv izolarea multi-tenant, nu doar că politicile există:
 * creează doi useri în workspace-uri diferite și confirmă că fiecare vede
 * exclusiv datele lui. Rulează după orice migrare (regulă din CLAUDE.md).
 *
 * Necesită SUPABASE_SERVICE_ROLE_KEY în .env.local.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// .env.local minimal parser — evită o dependință doar pentru asta.
for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SERVICE) {
  console.error('✗ SUPABASE_SERVICE_ROLE_KEY lipsește din .env.local')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TABLES = [
  'clients', 'statuses', 'activity_types', 'projects', 'activities',
  'comments', 'documents', 'interactions', 'status_history',
  'activity_assignments', 'ai_analysis_log', 'settings',
]

let failures = 0
function check(ok: boolean, label: string, detail = '') {
  if (ok) {
    console.log(`  ✓ ${label}`)
  } else {
    failures++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function makeUser(email: string, password: string) {
  // Curăță o rulare anterioară întreruptă.
  const { data: existing } = await admin.auth.admin.listUsers()
  const prior = existing.users.find((u) => u.email === email)
  if (prior) await admin.auth.admin.deleteUser(prior.id)

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  return data.user!
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

async function main() {
  const stamp = Date.now()
  const emailA = `rls-test-a-${stamp}@example.com`
  const emailB = `rls-test-b-${stamp}@example.com`
  const password = 'rls-test-password-123'

  const createdWorkspaces: string[] = []
  const createdUsers: string[] = []

  try {
    console.log('\nPregătire fixture…')
    const userA = await makeUser(emailA, password)
    const userB = await makeUser(emailB, password)
    createdUsers.push(userA.id, userB.id)

    const { data: wsA, error: wsAErr } = await admin
      .from('workspaces')
      .insert({ name: `RLS Test A ${stamp}`, slug: `rls-test-a-${stamp}` })
      .select('id')
      .single()
    if (wsAErr) throw wsAErr

    const { data: wsB, error: wsBErr } = await admin
      .from('workspaces')
      .insert({ name: `RLS Test B ${stamp}`, slug: `rls-test-b-${stamp}` })
      .select('id')
      .single()
    if (wsBErr) throw wsBErr
    createdWorkspaces.push(wsA.id, wsB.id)

    await admin.from('workspace_members').insert([
      { workspace_id: wsA.id, user_id: userA.id, role: 'admin' },
      { workspace_id: wsB.id, user_id: userB.id, role: 'admin' },
    ])

    await admin.from('clients').insert([
      { workspace_id: wsA.id, name: 'Client al lui A' },
      { workspace_id: wsB.id, name: 'Client al lui B' },
    ])

    const clientA = await signIn(emailA, password)
    const clientB = await signIn(emailB, password)

    console.log('\n1. Izolarea citirilor (userul A nu vede datele lui B)')
    const { data: aSees } = await clientA.from('clients').select('name, workspace_id')
    check(
      (aSees ?? []).every((c) => c.workspace_id === wsA.id),
      'clients: A vede doar workspace-ul lui',
      `a văzut ${aSees?.length ?? 0} rânduri`
    )
    check(
      !(aSees ?? []).some((c) => c.name === 'Client al lui B'),
      'clients: clientul lui B e invizibil pentru A'
    )

    const { data: aWorkspaces } = await clientA.from('workspaces').select('id')
    check(
      (aWorkspaces ?? []).every((w) => w.id === wsA.id),
      'workspaces: A vede doar workspace-ul lui'
    )

    console.log('\n2. Izolarea scrierilor (A nu poate scrie în workspace-ul lui B)')
    const { error: crossInsert } = await clientA
      .from('clients')
      .insert({ workspace_id: wsB.id, name: 'Injectat de A' })
    check(Boolean(crossInsert), 'clients: insert cross-workspace respins de WITH CHECK')

    const { data: crossUpdate } = await clientA
      .from('clients')
      .update({ name: 'Rescris de A' })
      .eq('workspace_id', wsB.id)
      .select('id')
    check((crossUpdate ?? []).length === 0, 'clients: update cross-workspace nu atinge niciun rând')

    const { data: crossDelete } = await clientA
      .from('clients')
      .delete()
      .eq('workspace_id', wsB.id)
      .select('id')
    check((crossDelete ?? []).length === 0, 'clients: delete cross-workspace nu atinge niciun rând')

    console.log('\n3. Tabele deny-all')
    const { data: allowlist } = await clientA.from('allowed_emails').select('email')
    check((allowlist ?? []).length === 0, 'allowed_emails: invizibil pentru useri normali')

    console.log('\n4. Fiecare tabelă scoped pe workspace refuză workspace-ul străin')
    // Userul B interoghează explicit workspace-ul lui A: orice rând returnat
    // înseamnă politică lipsă sau greșită pe tabela respectivă.
    for (const table of TABLES) {
      const { data } = await clientB.from(table).select('*').eq('workspace_id', wsA.id)
      check((data ?? []).length === 0, `${table}: 0 rânduri din workspace străin`)
    }

    console.log('\n5. Istoricul de status se scrie automat')
    const { data: statusA } = await admin
      .from('statuses')
      .insert({ workspace_id: wsA.id, name: 'Lead', sort_order: 10 })
      .select('id')
      .single()
    const { data: newClient } = await admin
      .from('clients')
      .insert({ workspace_id: wsA.id, name: 'Client cu status', current_status_id: statusA!.id })
      .select('id')
      .single()
    const { data: history } = await admin
      .from('status_history')
      .select('to_status_id')
      .eq('client_id', newClient!.id)
    check(
      (history ?? []).length === 1 && history![0].to_status_id === statusA!.id,
      'status_history: trigger-ul a scris rândul la insert'
    )
  } finally {
    console.log('\nCurățare fixture…')
    for (const id of createdWorkspaces) await admin.from('workspaces').delete().eq('id', id)
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id)
  }

  console.log(
    failures === 0
      ? '\n✓ Toate verificările RLS au trecut.\n'
      : `\n✗ ${failures} verificări RLS au eșuat.\n`
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('\nEroare la rularea testelor RLS:', err)
  process.exit(1)
})
