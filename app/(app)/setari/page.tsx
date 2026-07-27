import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId, listWorkspaces } from '@/lib/workspace'
import { getCurrentUser } from '@/lib/auth'
import SettingsClient from '@/components/SettingsClient'
import type { GmailConnectionPublic, ProjectType, Status } from '@/lib/types'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string }>
}) {
  const { gmail } = await searchParams
  const supabase = await createSupabaseServerClient()
  const [workspaceId, user] = await Promise.all([getWorkspaceId(supabase), getCurrentUser()])
  if (!workspaceId) return null

  const [statusesRes, clientsRes, workspaces, prefRes, gmailRes, projectTypesRes, projectsRes] = await Promise.all([
    supabase
      .from('statuses')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true }),
    supabase.from('clients').select('current_status_id').eq('workspace_id', workspaceId),
    listWorkspaces(supabase),
    supabase
      .from('user_preferences')
      .select('digest_enabled')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user!.id)
      .maybeSingle(),
    supabase
      .from('gmail_connections')
      .select('id, email, created_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user!.id)
      .maybeSingle(),
    supabase
      .from('project_types')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true }),
    supabase.from('projects').select('type').eq('workspace_id', workspaceId),
  ])

  // Câți clienți atârnă de fiecare status — afișat înainte de ștergere.
  const usage: Record<string, number> = {}
  for (const row of clientsRes.data ?? []) {
    if (row.current_status_id) usage[row.current_status_id] = (usage[row.current_status_id] ?? 0) + 1
  }

  // Câte proiecte au fiecare tip — afișat înainte de ștergerea tipului.
  const projectTypeUsage: Record<string, number> = {}
  for (const row of projectsRes.data ?? []) {
    projectTypeUsage[row.type] = (projectTypeUsage[row.type] ?? 0) + 1
  }

  return (
    <SettingsClient
      statuses={(statusesRes.data ?? []) as Status[]}
      usage={usage}
      workspaces={workspaces}
      digestEnabled={prefRes.data?.digest_enabled ?? true}
      gmailConnection={gmailRes.data as GmailConnectionPublic | null}
      gmailStatus={gmail}
      projectTypes={(projectTypesRes.data ?? []) as ProjectType[]}
      projectTypeUsage={projectTypeUsage}
    />
  )
}
