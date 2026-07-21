import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { getAllSettings } from '@/lib/config'
import { getWorkspaceMembers } from '@/lib/workspace-members'
import { getCurrentUser } from '@/lib/auth'
import {
  buildKpis,
  buildPeriodStats,
  buildPipeline,
  buildTeamPerformance,
  computeStreak,
  groupActivities,
} from '@/lib/dashboard'
import DashboardClient from '@/components/DashboardClient'
import type { Activity, Client, PortfolioRanking, Status, StatusHistoryEntry } from '@/lib/types'

export type ActivityWithClient = Activity & { clients: { name: string } | null }
export type RankingWithClient = PortfolioRanking & { clients: { name: string } | null }

export default async function TodayPage() {
  const supabase = await createSupabaseServerClient()
  const [workspaceId, user] = await Promise.all([getWorkspaceId(supabase), getCurrentUser()])
  if (!workspaceId) return null

  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString()

  const [
    settings,
    statusesRes,
    clientsRes,
    activitiesRes,
    historyRes,
    followUpsRes,
    members,
    myInteractionsRes,
    myCommentsRes,
  ] = await Promise.all([
    getAllSettings(supabase, workspaceId),
    supabase
      .from('statuses')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true }),
    supabase.from('clients').select('*').eq('workspace_id', workspaceId),
    supabase.from('activities').select('*, clients(name)').eq('workspace_id', workspaceId),
    supabase
      .from('status_history')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('changed_at', thirtyDaysAgo),
    supabase
      .from('clients')
      .select('id, name, next_step_date, next_step_description')
      .eq('workspace_id', workspaceId)
      .not('next_step_date', 'is', null)
      .lte('next_step_date', today)
      .order('next_step_date', { ascending: true }),
    getWorkspaceMembers(workspaceId),
    supabase
      .from('interactions')
      .select('created_at')
      .eq('workspace_id', workspaceId)
      .eq('created_by', user!.id)
      .gte('created_at', sixtyDaysAgo),
    supabase
      .from('comments')
      .select('created_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user!.id)
      .gte('created_at', sixtyDaysAgo),
  ])

  const { data: rankingsRaw } = await supabase
    .from('portfolio_rankings')
    .select('*, clients(name)')
    .eq('workspace_id', workspaceId)
    .order('rank', { ascending: true })

  const clients = (clientsRes.data ?? []) as Client[]
  const statuses = (statusesRes.data ?? []) as Status[]
  const activities = (activitiesRes.data ?? []) as ActivityWithClient[]
  const history = (historyRes.data ?? []) as StatusHistoryEntry[]
  const openActivities = activities.filter((a) => a.status !== 'done')

  const pipeline = buildPipeline(clients, statuses)
  const kpis = buildKpis(clients, statuses)
  const period = buildPeriodStats(history, statuses)
  const activityGroups = groupActivities(openActivities)
  const waitingOnClient = openActivities.filter((a) => a.client_id && a.waiting_on === 'client')
  const waitingOnMe = openActivities.filter((a) => a.client_id && a.waiting_on === 'me')
  const teamPerformance = buildTeamPerformance(members, clients, activities, statuses)

  const myDoneDates = activities
    .filter((a) => a.assigned_to === user!.id && a.status === 'done' && a.done_date)
    .map((a) => a.done_date as string)
  const checkinDates = [
    ...myDoneDates,
    ...(myInteractionsRes.data ?? []).map((i: { created_at: string }) => i.created_at),
    ...(myCommentsRes.data ?? []).map((c: { created_at: string }) => c.created_at),
  ]
  const streak = computeStreak(checkinDates)

  return (
    <DashboardClient
      overdueFollowUps={followUpsRes.data ?? []}
      activityGroups={activityGroups}
      waitingOnClient={waitingOnClient}
      waitingOnMe={waitingOnMe}
      pipeline={pipeline}
      kpis={kpis}
      period={period}
      teamPerformance={teamPerformance}
      streak={streak}
      portfolioRankings={(rankingsRaw ?? []) as RankingWithClient[]}
      currency={settings.currency}
    />
  )
}
