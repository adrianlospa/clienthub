import { formatDate } from './fmt'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

// Concatenează istoricul complet al clientului într-un context text simplu —
// fără vector DB, conform spec (§7): "just concatenate the client's records
// into context — no vector DB needed initially".
export async function buildClientContext(supabase: Db, clientId: string): Promise<string> {
  const [clientRes, statusesRes, historyRes, commentsRes, interactionsRes, activitiesRes] =
    await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
      supabase.from('statuses').select('id, name'),
      supabase
        .from('status_history')
        .select('*')
        .eq('client_id', clientId)
        .order('changed_at', { ascending: true }),
      supabase
        .from('comments')
        .select('*')
        .eq('parent_type', 'client')
        .eq('parent_id', clientId)
        .order('created_at', { ascending: true }),
      supabase
        .from('interactions')
        .select('*')
        .eq('client_id', clientId)
        .order('occurred_at', { ascending: true }),
      supabase.from('activities').select('*').eq('client_id', clientId).order('due_date', { ascending: true }),
    ])

  const client = clientRes.data
  if (!client) return ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusById = new Map((statusesRes.data ?? []).map((s: any) => [s.id, s.name]))

  const lines: string[] = []
  lines.push(`# Client: ${client.name}${client.company_name ? ` (${client.company_name})` : ''}`)
  lines.push(`Status curent: ${statusById.get(client.current_status_id) ?? 'fără status'}`)
  lines.push(`Valoare estimată: ${client.estimated_value ?? '—'} ${client.currency}`)
  lines.push(`Adăugat: ${formatDate(client.date_added)}`)
  if (client.next_step_date || client.next_step_description) {
    lines.push(
      `Pas următor: ${client.next_step_description ?? '—'} (${formatDate(client.next_step_date)})`
    )
  }

  const history = historyRes.data ?? []
  if (history.length) {
    lines.push('\n## Istoric status')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const h of history as any[]) {
      const from = h.from_status_id ? statusById.get(h.from_status_id) : 'nou'
      const to = statusById.get(h.to_status_id) ?? '—'
      lines.push(`- ${formatDate(h.changed_at)}: ${from} → ${to}`)
    }
  }

  const interactions = interactionsRes.data ?? []
  if (interactions.length) {
    lines.push('\n## Discuții')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const i of interactions as any[]) {
      lines.push(
        `- ${formatDate(i.occurred_at)} [${i.channel}, ${i.direction === 'out' ? 'trimis' : 'primit'}]: ${i.summary ?? '—'}`
      )
    }
  }

  const comments = commentsRes.data ?? []
  if (comments.length) {
    lines.push('\n## Notițe')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of comments as any[]) {
      lines.push(`- ${formatDate(c.created_at)}: ${c.text}`)
    }
  }

  const activities = activitiesRes.data ?? []
  if (activities.length) {
    lines.push('\n## Activități')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of activities as any[]) {
      lines.push(
        `- [${a.status}] ${a.title}${a.due_date ? ` (termen ${formatDate(a.due_date)})` : ''}${a.waiting_on ? ` — așteaptă: ${a.waiting_on === 'client' ? 'clientul' : 'eu'}` : ''}`
      )
    }
  }

  return lines.join('\n')
}
