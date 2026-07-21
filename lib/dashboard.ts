import type { Activity, Client, Status, StatusHistoryEntry } from './types'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

// ------------------------------------------------------------------ pipeline

export type PipelineColumn = { status: Status; count: number; totalValue: number }

export function buildPipeline(clients: Client[], statuses: Status[]): PipelineColumn[] {
  return statuses.map((status) => {
    const inStatus = clients.filter((c) => c.current_status_id === status.id)
    return {
      status,
      count: inStatus.length,
      totalValue: inStatus.reduce((sum, c) => sum + (c.estimated_value ?? 0), 0),
    }
  })
}

// ----------------------------------------------------------------------- kpi

export type Kpis = {
  totalClients: number
  activeOpportunities: number
  won: number
  lost: number
  conversionRate: number
  activePipelineValue: number
  wonValue: number
  overdueFollowUps: number
}

export function buildKpis(clients: Client[], statuses: Status[]): Kpis {
  const statusById = new Map(statuses.map((s) => [s.id, s]))
  const today = startOfToday()

  let won = 0
  let lost = 0
  let activeOpportunities = 0
  let activePipelineValue = 0
  let wonValue = 0
  let overdueFollowUps = 0

  for (const c of clients) {
    const status = c.current_status_id ? statusById.get(c.current_status_id) : null
    const value = c.estimated_value ?? 0
    if (status?.is_won) {
      won++
      wonValue += value
    } else if (status?.is_lost) {
      lost++
    } else {
      activeOpportunities++
      activePipelineValue += value
    }
    if (c.next_step_date && new Date(c.next_step_date) < today) overdueFollowUps++
  }

  const decided = won + lost
  const conversionRate = decided > 0 ? Math.round((won / decided) * 100) : 0

  return {
    totalClients: clients.length,
    activeOpportunities,
    won,
    lost,
    conversionRate,
    activePipelineValue,
    wonValue,
    overdueFollowUps,
  }
}

// ------------------------------------------------------------- period stats

export type PeriodStats = { offersSent: number; contractsSigned: number }

export function buildPeriodStats(
  history: StatusHistoryEntry[],
  statuses: Status[],
  days = 30
): PeriodStats {
  const statusById = new Map(statuses.map((s) => [s.id, s]))
  const cutoff = new Date(Date.now() - days * 86_400_000)

  let offersSent = 0
  let contractsSigned = 0
  for (const h of history) {
    if (new Date(h.changed_at) < cutoff) continue
    const to = h.to_status_id ? statusById.get(h.to_status_id) : null
    if (!to) continue
    if (/ofert/i.test(to.name)) offersSent++
    if (to.is_won) contractsSigned++
  }
  return { offersSent, contractsSigned }
}

// -------------------------------------------------------------- activities

export type ActivityGroups<T extends Activity = Activity> = { overdue: T[]; today: T[]; thisWeek: T[] }

export function groupActivities<T extends Activity>(activities: T[]): ActivityGroups<T> {
  const today = startOfToday()
  const weekEnd = new Date(today.getTime() + 7 * 86_400_000)

  const open = activities.filter((a) => a.status !== 'done' && a.due_date)
  const overdue: T[] = []
  const todayList: T[] = []
  const thisWeek: T[] = []

  for (const a of open) {
    const due = new Date(a.due_date!)
    if (due < today) overdue.push(a)
    else if (due.getTime() === today.getTime()) todayList.push(a)
    else if (due < weekEnd) thisWeek.push(a)
  }

  const byDue = (x: T, y: T) => new Date(x.due_date!).getTime() - new Date(y.due_date!).getTime()
  return { overdue: overdue.sort(byDue), today: todayList.sort(byDue), thisWeek: thisWeek.sort(byDue) }
}

export function daysOverdue(dueDate: string): number {
  return daysBetween(new Date(dueDate), startOfToday())
}

// -------------------------------------------------------- team performance

export type MemberStats = {
  userId: string
  email: string
  activeClients: number
  won: number
  lost: number
  completedThisWeek: number
  overdue: number
}

export function buildTeamPerformance(
  members: { userId: string; email: string }[],
  clients: Client[],
  activities: Activity[],
  statuses: Status[]
): MemberStats[] {
  const statusById = new Map(statuses.map((s) => [s.id, s]))
  const today = startOfToday()
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000)

  return members.map((m) => {
    const ownClients = clients.filter((c) => c.owner_user_id === m.userId)
    let activeClients = 0
    let won = 0
    let lost = 0
    for (const c of ownClients) {
      const status = c.current_status_id ? statusById.get(c.current_status_id) : null
      if (status?.is_won) won++
      else if (status?.is_lost) lost++
      else activeClients++
    }

    const own = activities.filter((a) => a.assigned_to === m.userId)
    const completedThisWeek = own.filter(
      (a) => a.status === 'done' && a.done_date && new Date(a.done_date) >= weekAgo
    ).length
    const overdue = own.filter(
      (a) => a.status !== 'done' && a.due_date && new Date(a.due_date) < today
    ).length

    return { userId: m.userId, email: m.email, activeClients, won, lost, completedThisWeek, overdue }
  })
}

// -------------------------------------------------------------------- streak

// Zile consecutive cu cel puțin o activitate finalizată sau un check-in
// (discuție logată / notiță adăugată). Ziua curentă nu rupe streak-ul dacă
// încă n-a fost bifat nimic azi — doar dacă și ieri lipsește.
export function computeStreak(checkinDates: string[]): number {
  const daySet = new Set(checkinDates.map((d) => new Date(d).toDateString()))
  let cursor = startOfToday()
  if (!daySet.has(cursor.toDateString())) {
    cursor = new Date(cursor.getTime() - 86_400_000)
  }
  let streak = 0
  while (daySet.has(cursor.toDateString())) {
    streak++
    cursor = new Date(cursor.getTime() - 86_400_000)
  }
  return streak
}
