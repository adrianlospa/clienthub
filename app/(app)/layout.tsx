import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId, listWorkspaces } from '@/lib/workspace'
import { getCurrentUser } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [workspaces, workspaceId] = await Promise.all([
    listWorkspaces(supabase),
    getWorkspaceId(supabase),
  ])

  const { data: notifications } = workspaceId
    ? await supabase
        .from('notifications')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(30)
    : { data: [] }

  if (workspaces.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-lg border border-line bg-surface p-8 text-center">
          <h1 className="text-lg font-semibold text-ink">Niciun workspace</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Contul tău nu e încă membru al niciunui workspace. Rulează <code>supabase/seed.sql</code>{' '}
            sau cere o invitație unui admin.
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <Sidebar
        workspaces={workspaces}
        activeId={workspaceId}
        email={user.email ?? ''}
        notifications={notifications ?? []}
      />
      <main className="flex-1 px-6 py-8 max-md:px-4">{children}</main>
    </div>
  )
}
