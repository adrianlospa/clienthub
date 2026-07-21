import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { getAllSettings } from '@/lib/config'
import ClientsClient from '@/components/ClientsClient'
import type { Client, Status } from '@/lib/types'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createSupabaseServerClient()
  const workspaceId = await getWorkspaceId(supabase)
  if (!workspaceId) return null

  const [settings, statusesRes, clientsRes] = await Promise.all([
    getAllSettings(supabase, workspaceId),
    supabase
      .from('statuses')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false }),
  ])

  return (
    <ClientsClient
      workspaceId={workspaceId}
      clients={(clientsRes.data ?? []) as Client[]}
      statuses={(statusesRes.data ?? []) as Status[]}
      currency={settings.currency}
      initialStatusFilter={status ?? ''}
    />
  )
}
