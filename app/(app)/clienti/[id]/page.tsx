import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { getAllSettings } from '@/lib/config'
import { getWorkspaceMembers } from '@/lib/workspace-members'
import ClientDetailClient from '@/components/ClientDetailClient'
import type {
  Activity,
  ActivityType,
  Client,
  ClientDocument,
  Comment,
  Interaction,
  Status,
  StatusHistoryEntry,
} from '@/lib/types'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const workspaceId = await getWorkspaceId(supabase)
  if (!workspaceId) return null

  // RLS face filtrarea pe workspace — un id din alt workspace returnează null.
  const { data: client } = await supabase.from('clients').select('*').eq('id', id).maybeSingle()
  if (!client) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    settings,
    statusesRes,
    historyRes,
    interactionsRes,
    commentsRes,
    documentsRes,
    activitiesRes,
    activityTypesRes,
    members,
    gmailRes,
  ] = await Promise.all([
    getAllSettings(supabase, workspaceId),
    supabase
      .from('statuses')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('status_history')
      .select('*')
      .eq('client_id', id)
      .order('changed_at', { ascending: false }),
    supabase
      .from('interactions')
      .select('*')
      .eq('client_id', id)
      .order('occurred_at', { ascending: false }),
    supabase
      .from('comments')
      .select('*')
      .eq('parent_type', 'client')
      .eq('parent_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('*')
      .eq('parent_type', 'client')
      .eq('parent_id', id)
      .order('uploaded_at', { ascending: false }),
    supabase.from('activities').select('*').eq('client_id', id).order('due_date', { ascending: true }),
    supabase
      .from('activity_types')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true }),
    getWorkspaceMembers(workspaceId),
    supabase
      .from('gmail_connections')
      .select('id, email, created_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user!.id)
      .maybeSingle(),
  ])

  return (
    <ClientDetailClient
      workspaceId={workspaceId}
      client={client as Client}
      statuses={(statusesRes.data ?? []) as Status[]}
      history={(historyRes.data ?? []) as StatusHistoryEntry[]}
      interactions={(interactionsRes.data ?? []) as Interaction[]}
      comments={(commentsRes.data ?? []) as Comment[]}
      documents={(documentsRes.data ?? []) as ClientDocument[]}
      activities={(activitiesRes.data ?? []) as Activity[]}
      activityTypes={(activityTypesRes.data ?? []) as ActivityType[]}
      members={members}
      currentUserId={user!.id}
      currency={settings.currency}
      hasGmailConnection={Boolean(gmailRes.data)}
    />
  )
}
