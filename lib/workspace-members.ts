import { createSupabaseAdminClient } from './supabase-admin'
import type { WorkspaceMember } from './types'

// Emailurile din auth.users nu sunt expuse prin PostgREST normal (schema
// admin-only), deci citim cu admin client — sigur aici pentru că rulează
// doar server-side, în Server Components, și rezultatul (email + rol) e ceva
// ce colegii de workspace ar vedea oricum unii despre alții.
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const admin = createSupabaseAdminClient()
  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)

  if (!members?.length) return []

  const results = await Promise.all(
    members.map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id)
      return { userId: m.user_id, role: m.role as 'admin' | 'member', email: data.user?.email ?? m.user_id }
    })
  )
  return results
}
