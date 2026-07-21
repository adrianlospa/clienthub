import { formatDate } from './fmt'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export type DigestData = {
  followUpsToday: number
  overdueActivities: number
  waitingOnClientDays: { clientName: string; days: number }[]
}

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Construiește digest-ul pentru un singur user într-un workspace — follow-up-uri
// scadente azi, activități depășite asignate lui, clienți care așteaptă răspuns.
export async function buildDigestData(supabase: Db, workspaceId: string, userId: string): Promise<DigestData> {
  const today = new Date().toISOString().slice(0, 10)

  const [followUpsRes, activitiesRes, waitingRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('owner_user_id', userId)
      .not('next_step_date', 'is', null)
      .lte('next_step_date', today),
    supabase
      .from('activities')
      .select('id, due_date')
      .eq('workspace_id', workspaceId)
      .eq('assigned_to', userId)
      .neq('status', 'done')
      .not('due_date', 'is', null)
      .lt('due_date', today),
    supabase
      .from('activities')
      .select('client_id, updated_at, clients(name)')
      .eq('workspace_id', workspaceId)
      .eq('assigned_to', userId)
      .eq('waiting_on', 'client')
      .neq('status', 'done')
      .not('client_id', 'is', null),
  ])

  const today0 = startOfToday()
  const waitingOnClientDays = (waitingRes.data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((a: any) => {
      const days = Math.floor((today0.getTime() - new Date(a.updated_at).getTime()) / 86_400_000)
      return { clientName: a.clients?.name ?? 'Client', days }
    })
    .filter((w: { days: number }) => w.days > 0)

  return {
    followUpsToday: followUpsRes.data?.length ?? 0,
    overdueActivities: activitiesRes.data?.length ?? 0,
    waitingOnClientDays,
  }
}

export function isDigestEmpty(data: DigestData): boolean {
  return data.followUpsToday === 0 && data.overdueActivities === 0 && data.waitingOnClientDays.length === 0
}

export function renderDigestHtml(workspaceName: string, data: DigestData): string {
  const items: string[] = []
  if (data.followUpsToday > 0) {
    items.push(`<li>${data.followUpsToday} follow-up-uri de făcut azi</li>`)
  }
  if (data.overdueActivities > 0) {
    items.push(`<li>${data.overdueActivities} activități depășite</li>`)
  }
  for (const w of data.waitingOnClientDays.slice(0, 5)) {
    items.push(`<li>${w.clientName} așteaptă răspuns de ${w.days} ${w.days === 1 ? 'zi' : 'zile'}</li>`)
  }

  return `
    <div style="font-family: sans-serif; max-width: 480px;">
      <h2 style="color: #059669;">ClientHub — ${workspaceName}</h2>
      <p>Rezumatul zilei:</p>
      <ul>${items.join('')}</ul>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}" style="color: #059669;">Deschide ClientHub →</a></p>
    </div>
  `
}
