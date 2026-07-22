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
    <aside className="flex w-64 shrink-0 flex-col bg-ink px-5 py-6 max-md:w-full">
      <div className="flex items-center justify-between px-1">
        <span className="font-display text-xl tracking-tight text-paper">ClientHub</span>
        <NotificationBell notifications={notifications} />
      </div>
      <p className="mt-0.5 px-1 font-data text-[10px] uppercase tracking-[0.2em] text-paper/40">
        Registru de clienți
      </p>

      <div className="mt-5">
        <WorkspaceSwitcher workspaces={workspaces} activeId={activeId} />
      </div>

      <nav className="mt-6 flex flex-col gap-0.5 max-md:flex-row">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-paper/10 text-gold-100'
                  : 'text-paper/60 hover:bg-paper/5 hover:text-paper'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-paper/10 pt-4 max-md:hidden">
        <p className="truncate px-3 font-data text-xs text-paper/40">{email}</p>
        <button
          onClick={signOut}
          className="mt-1 w-full rounded px-3 py-2 text-left text-sm text-paper/60 hover:bg-paper/5 hover:text-paper"
        >
          Ieși din cont
        </button>
      </div>
    </aside>
  )
}
