import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import ProjectsClient from '@/components/ProjectsClient'
import type { Project, ProjectType } from '@/lib/types'

export default async function ProjectsPage() {
  const supabase = await createSupabaseServerClient()
  const workspaceId = await getWorkspaceId(supabase)
  if (!workspaceId) return null

  const [projectsRes, projectTypesRes] = await Promise.all([
    supabase.from('projects').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    supabase
      .from('project_types')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true }),
  ])

  return (
    <ProjectsClient
      projects={(projectsRes.data ?? []) as Project[]}
      projectTypes={(projectTypesRes.data ?? []) as ProjectType[]}
    />
  )
}
