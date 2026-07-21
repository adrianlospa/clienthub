'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import NotificationBell from './NotificationBell'
import type { WorkspaceOption } from '@/lib/workspace'
import type { Notification } from '@/lib/types'

const NAV = [
  { href: '/', label: 'Azi' },
  { href: '/clienti', label: 'Clienți' },
  { href: '/proiecte', label: 'Proiecte' },
  { href: '/setari', label: 'Setări' },
] as const

export default function Sidebar({
  workspaces,
  activeId,
  email,
  notifications,
}: {
  workspaces: WorkspaceOption[]
  activeId: string | null
  email: string
  notifications: Notification[]
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 max-md:w-full max-md:border-r-0 max-md:border-b">
      <div className="flex items-center justify-between px-2">
        <span className="text-lg font-semibold text-slate-900">ClientHub</span>
        <NotificationBell notifications={notifications} />
      </div>

      <div className="mt-4">
        <WorkspaceSwitcher workspaces={workspaces} activeId={activeId} />
      </div>

      <nav className="mt-6 flex flex-col gap-1 max-md:flex-row">
        {NAV.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-accent-50 text-accent-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-6 max-md:hidden">
        <p className="truncate px-3 text-xs text-slate-400">{email}</p>
        <button
          onClick={signOut}
          className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
        >
          Ieși din cont
        </button>
      </div>
    </aside>
  )
}
