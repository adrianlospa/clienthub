import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { getWorkspaceMembers } from '@/lib/workspace-members'
import { getCurrentUser } from '@/lib/auth'
import ProjectDetailClient from '@/components/ProjectDetailClient'
import type { Activity, ActivityType, ClientDocument, Comment, Project } from '@/lib/types'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const [workspaceId, user, projectRes] = await Promise.all([
    getWorkspaceId(supabase),
    getCurrentUser(),
    supabase.from('projects').select('*').eq('id', id).maybeSingle(),
  ])
  if (!workspaceId) return null
  const project = projectRes.data
  if (!project) notFound()

  const [activitiesRes, activityTypesRes, commentsRes, documentsRes, members] = await Promise.all([
    supabase.from('activities').select('*').eq('project_id', id).order('due_date', { ascending: true }),
    supabase
      .from('activity_types')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('comments')
      .select('*')
      .eq('parent_type', 'project')
      .eq('parent_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('*')
      .eq('parent_type', 'project')
      .eq('parent_id', id)
      .order('uploaded_at', { ascending: false }),
    getWorkspaceMembers(workspaceId),
  ])

  return (
    <ProjectDetailClient
      workspaceId={workspaceId}
      project={project as Project}
      activities={(activitiesRes.data ?? []) as Activity[]}
      activityTypes={(activityTypesRes.data ?? []) as ActivityType[]}
      comments={(commentsRes.data ?? []) as Comment[]}
      documents={(documentsRes.data ?? []) as ClientDocument[]}
      members={members}
      currentUserId={user!.id}
    />
  )
}
