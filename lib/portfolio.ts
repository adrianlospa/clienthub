// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export type PortfolioCandidate = {
  id: string
  name: string
  statusName: string
  daysInStatus: number | null
  lastInteractionDaysAgo: number | null
  estimatedValue: number | null
  currency: string
}

const daysSince = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null)

// Construiește lista de clienți activi (nici câștigați, nici pierduți) cu
// semnalele relevante pentru ranking: vechime în status, ultima interacțiune,
// valoare estimată — pe care Claude le combină într-un scor de prioritate.
export async function buildPortfolioCandidates(
  supabase: Db,
  workspaceId: string
): Promise<PortfolioCandidate[]> {
  const [clientsRes, statusesRes, historyRes, interactionsRes] = await Promise.all([
    supabase.from('clients').select('*').eq('workspace_id', workspaceId),
    supabase.from('statuses').select('id, name, is_won, is_lost').eq('workspace_id', workspaceId),
    supabase
      .from('status_history')
      .select('client_id, to_status_id, changed_at')
      .eq('workspace_id', workspaceId)
      .order('changed_at', { ascending: false }),
    supabase
      .from('interactions')
      .select('client_id, occurred_at')
      .eq('workspace_id', workspaceId)
      .order('occurred_at', { ascending: false }),
  ])

  const statusById = new Map<string, { name: string; is_won: boolean; is_lost: boolean }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (statusesRes.data ?? []).map((s: any) => [s.id, s])
  )

  const lastStatusChange = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const h of (historyRes.data ?? []) as any[]) {
    if (!lastStatusChange.has(h.client_id)) lastStatusChange.set(h.client_id, h.changed_at)
  }

  const lastInteraction = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const i of (interactionsRes.data ?? []) as any[]) {
    if (!lastInteraction.has(i.client_id)) lastInteraction.set(i.client_id, i.occurred_at)
  }

  const candidates: PortfolioCandidate[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (clientsRes.data ?? []) as any[]) {
    const status = c.current_status_id ? statusById.get(c.current_status_id) : null
    if (status?.is_won || status?.is_lost) continue

    candidates.push({
      id: c.id,
      name: c.name,
      statusName: status?.name ?? 'fără status',
      daysInStatus: daysSince(lastStatusChange.get(c.id) ?? c.date_added),
      lastInteractionDaysAgo: daysSince(lastInteraction.get(c.id) ?? null),
      estimatedValue: c.estimated_value,
      currency: c.currency,
    })
  }

  return candidates
}

export function renderPortfolioContext(candidates: PortfolioCandidate[]): string {
  return candidates
    .map(
      (c) =>
        `- id=${c.id} | ${c.name} | status: ${c.statusName} (de ${c.daysInStatus ?? '?'} zile) | ` +
        `ultima interacțiune: ${c.lastInteractionDaysAgo === null ? 'niciodată' : `acum ${c.lastInteractionDaysAgo} zile`} | ` +
        `valoare: ${c.estimatedValue ?? '—'} ${c.currency}`
    )
    .join('\n')
}
