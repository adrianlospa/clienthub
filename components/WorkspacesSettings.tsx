'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkspaceOption } from '@/lib/workspace'

export default function WorkspacesSettings({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function rename(id: string) {
    if (!editingName.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Redenumirea a eșuat.')
        return
      }
      setEditingId(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Crearea a eșuat.')
        return
      }
      setNewName('')
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Workspace-uri</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Fiecare workspace are propriile statusuri, clienți și activități. Doar adminii unui
        workspace îi pot schimba numele.
      </p>

      {error && <p className="mt-4 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</p>}

      <div className="mt-4 space-y-2">
        {workspaces.map((w) => (
          <div key={w.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-0">
            {editingId === w.id ? (
              <>
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') rename(w.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-accent-500"
                />
                <button
                  onClick={() => rename(w.id)}
                  disabled={busy}
                  className="text-xs font-medium text-accent-700 hover:underline"
                >
                  Salvează
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs text-ink-muted hover:underline"
                >
                  Anulează
                </button>
              </>
            ) : (
              <>
                <span className="min-w-32 font-medium text-ink">{w.name}</span>
                <span className="text-xs text-ink-faint">{w.slug}</span>
                <span className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-muted">
                  {w.role === 'admin' ? 'admin' : 'membru'}
                </span>
                {w.role === 'admin' && (
                  <button
                    onClick={() => {
                      setEditingId(w.id)
                      setEditingName(w.name)
                    }}
                    className="ml-auto text-xs text-ink-muted hover:underline"
                  >
                    Redenumește
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={createWorkspace} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
        <label className="text-sm font-medium text-ink">
          Workspace nou
          <input
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Newsletter Pro"
            className="mt-1 block rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700 disabled:opacity-60"
        >
          {creating ? 'Se creează…' : 'Adaugă'}
        </button>
      </form>
    </section>
  )
}
