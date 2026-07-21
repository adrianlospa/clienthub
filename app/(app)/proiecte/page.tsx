import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import ProjectsClient from '@/components/ProjectsClient'
import type { Project } from '@/lib/types'

export default async function ProjectsPage() {
  const supabase = await createSupabaseServerClient()
  const workspaceId = await getWorkspaceId(supabase)
  if (!workspaceId) return null

  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  return <ProjectsClient projects={(data ?? []) as Project[]} />
}
