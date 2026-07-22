'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Notification } from '@/lib/types'
import { relativeDays } from '@/lib/fmt'

export default function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const unread = notifications.filter((n) => !n.read_at)

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-50"
        aria-label="Notificări"
      >
        🔔
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 w-72 rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-100">
            {notifications.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500">Nicio notificare.</p>
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {notifications.slice(0, 15).map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-lg px-2 py-2 text-sm ${n.read_at ? 'text-slate-500' : 'bg-accent-50 text-slate-800'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {n.link ? (
                        <Link
                          href={n.link as never}
                          onClick={() => {
                            setOpen(false)
                            if (!n.read_at) markRead(n.id)
                          }}
                          className="font-medium hover:underline"
                        >
                          {n.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{n.title}</span>
                      )}
                      {!n.read_at && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="shrink-0 text-xs text-accent-700 hover:underline"
                        >
                          citit
                        </button>
                      )}
                    </div>
                    {n.body && <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-slate-400">{relativeDays(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
