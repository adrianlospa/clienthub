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
        className="relative rounded p-2 text-paper/70 hover:bg-paper/10 hover:text-paper"
        aria-label={unread.length > 0 ? `Notificări (${unread.length} necitite)` : 'Notificări'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread.length > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold-600 text-[9px] font-semibold text-ink">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 w-72 rounded-xl bg-surface p-2 shadow-lg ring-1 ring-line">
            {notifications.length === 0 ? (
              <p className="px-2 py-3 text-sm text-ink-muted">Nicio notificare.</p>
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {notifications.slice(0, 15).map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-lg px-2 py-2 text-sm ${n.read_at ? 'text-ink-muted' : 'bg-accent-50 text-ink'}`}
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
                    {n.body && <p className="mt-0.5 text-xs text-ink-muted">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-ink-faint">{relativeDays(n.created_at)}</p>
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
