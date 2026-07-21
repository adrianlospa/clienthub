import { cookies } from 'next/headers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any }

export const ACTIVE_WORKSPACE_COOKIE = 'active_workspace_id'

export async function getWorkspaceId(supabase: Db): Promise<string | null> {
  const cookieStore = await cookies()
  const activeId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value

  // Trust the cookie — RLS on every table enforces actual membership.
  // A forged cookie just returns empty data; the verification query is redundant.
  if (activeId) return activeId

  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.workspace_id ?? null
}

export type WorkspaceOption = {
  id: string
  name: string
  slug: string
  role: 'admin' | 'member'
}

export async function listWorkspaces(supabase: Db): Promise<WorkspaceOption[]> {
  const { data } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, slug)')
    .order('created_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).flatMap((row: any) =>
    row.workspaces
      ? [{ id: row.workspaces.id, name: row.workspaces.name, slug: row.workspaces.slug, role: row.role }]
      : []
  )
}
