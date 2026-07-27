'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import type { WorkspaceOption } from '@/lib/workspace'

export default function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: WorkspaceOption[]
  activeId: string | null
}) {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)

  async function switchTo(workspaceId: string) {
    if (workspaceId === activeId) return
    setPending(true)
    try {
      const res = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })
      if (!res.ok) {
        setPending(false)
        return
      }

      // Navigare completă de pagină, nu router.push/refresh — rutele au deja
      // un Router Cache client-side (din prefetch), care ar servi conținutul
      // vechi, din workspace-ul dinainte de schimbare.
      const isDetailPage = /^\/(clienti|proiecte)\/.+/.test(pathname)
      window.location.href = isDetailPage ? pathname.replace(/^(\/(?:clienti|proiecte))\/.+/, '$1') : pathname
    } catch {
      setPending(false)
    }
  }

  return (
    <select
      value={activeId ?? ''}
      disabled={pending}
      onChange={(e) => switchTo(e.target.value)}
      aria-label="Workspace activ"
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-accent-500"
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  )
}
