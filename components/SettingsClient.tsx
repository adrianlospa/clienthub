'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GmailConnectionPublic, ProjectType, Status } from '@/lib/types'
import type { WorkspaceOption } from '@/lib/workspace'
import WorkspacesSettings from './WorkspacesSettings'
import NotificationSettings from './NotificationSettings'
import GmailSettings from './GmailSettings'
import ProjectTypesSettings from './ProjectTypesSettings'

export default function SettingsClient({
  statuses,
  usage,
  workspaces,
  digestEnabled,
  gmailConnection,
  gmailStatus,
  projectTypes,
  projectTypeUsage,
}: {
  statuses: Status[]
  usage: Record<string, number>
  workspaces: WorkspaceOption[]
  digestEnabled: boolean
  gmailConnection: GmailConnectionPublic | null
  gmailStatus?: string
  projectTypes: ProjectType[]
  projectTypeUsage: Record<string, number>
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhase, setNewPhase] = useState<'pre_sale' | 'post_sale'>('pre_sale')
  const [newColor, setNewColor] = useState('#64748b')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? 'Operațiunea a eșuat.')
        return false
      }
      router.refresh()
      return true
    } finally {
      setBusy(false)
    }
  }

  async function addStatus(e: React.FormEvent) {
    e.preventDefault()
    const maxOrder = statuses.reduce((m, s) => Math.max(m, s.sort_order), 0)
    const ok = await call('/api/statuses', 'POST', {
      name: newName,
      color: newColor,
      phase: newPhase,
      sort_order: maxOrder + 10,
    })
    if (ok) setNewName('')
  }

  async function remove(status: Status) {
    const count = usage[status.id] ?? 0
    const msg = count
      ? `„${status.name}" e folosit de ${count} ${count === 1 ? 'client' : 'clienți'}. Aceștia rămân, dar fără status. Ștergi?`
      : `Ștergi statusul „${status.name}"?`
    if (!confirm(msg)) return
    await call(`/api/statuses/${status.id}`, 'DELETE')
  }

  async function rename(status: Status) {
    if (!editingName.trim() || editingName.trim() === status.name) {
      setEditingId(null)
      return
    }
    const ok = await call(`/api/statuses/${status.id}`, 'PATCH', { name: editingName.trim() })
    if (ok) setEditingId(null)
  }

  async function move(status: Status, direction: 'up' | 'down') {
    const idx = statuses.findIndex((s) => s.id === status.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= statuses.length) return
    const other = statuses[swapIdx]
    setBusy(true)
    setError(null)
    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/statuses/${status.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: other.sort_order }),
        }),
        fetch(`/api/statuses/${other.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: status.sort_order }),
        }),
      ])
      if (!resA.ok || !resB.ok) {
        setError('Reordonarea a eșuat.')
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Setări</h1>
      <p className="mt-1 text-sm text-slate-500">
        Statusurile sunt per workspace. Ordinea de aici dictează ordinea coloanelor din pipeline.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6">
        <WorkspacesSettings workspaces={workspaces} />
      </div>

      <div className="mt-6">
        <NotificationSettings digestEnabled={digestEnabled} />
      </div>

      <div className="mt-6">
        <GmailSettings connection={gmailConnection} statusParam={gmailStatus} />
      </div>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Statusuri</h2>

        <div className="mt-4 space-y-2">
          {statuses.map((s, idx) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-slate-50 py-2 last:border-0">
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(s, 'up')}
                  disabled={busy || idx === 0}
                  aria-label={`Mută „${s.name}" mai sus`}
                  className="leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(s, 'down')}
                  disabled={busy || idx === statuses.length - 1}
                  aria-label={`Mută „${s.name}" mai jos`}
                  className="leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              <input
                type="color"
                value={s.color}
                disabled={busy}
                onChange={(e) => call(`/api/statuses/${s.id}`, 'PATCH', { color: e.target.value })}
                aria-label={`Culoare pentru ${s.name}`}
                className="h-8 w-8 shrink-0 cursor-pointer rounded border border-slate-200"
              />
              {editingId === s.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => rename(s)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') rename(s)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-accent-500"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(s.id)
                    setEditingName(s.name)
                  }}
                  className="min-w-0 break-words text-left font-medium text-slate-800 hover:underline"
                  title="Redenumește"
                >
                  {s.name}
                </button>
              )}
              <select
                value={s.phase}
                disabled={busy}
                onChange={(e) => call(`/api/statuses/${s.id}`, 'PATCH', { phase: e.target.value })}
                aria-label={`Faza pentru ${s.name}`}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-accent-500"
              >
                <option value="pre_sale">Pre-vânzare</option>
                <option value="post_sale">Post-vânzare</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={s.is_won}
                  disabled={busy}
                  onChange={(e) => call(`/api/statuses/${s.id}`, 'PATCH', { is_won: e.target.checked })}
                />
                Câștigat
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={s.is_lost}
                  disabled={busy}
                  onChange={(e) => call(`/api/statuses/${s.id}`, 'PATCH', { is_lost: e.target.checked })}
                />
                Pierdut
              </label>
              <span className="text-xs text-slate-400">{usage[s.id] ?? 0} clienți</span>
              <button
                onClick={() => remove(s)}
                disabled={busy}
                className="ml-auto text-xs text-red-600 hover:underline"
              >
                Șterge
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={addStatus} className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5">
          <label className="text-sm font-medium text-slate-700">
            Status nou
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Negociere"
              className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-500"
            />
          </label>
          <select
            value={newPhase}
            onChange={(e) => setNewPhase(e.target.value as 'pre_sale' | 'post_sale')}
            aria-label="Faza statusului nou"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-500"
          >
            <option value="pre_sale">Pre-vânzare</option>
            <option value="post_sale">Post-vânzare</option>
          </select>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            aria-label="Culoarea statusului nou"
            className="h-9 w-9 cursor-pointer rounded border border-slate-200"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700 disabled:opacity-60"
          >
            Adaugă
          </button>
        </form>
      </section>

      <div className="mt-6">
        <ProjectTypesSettings projectTypes={projectTypes} usage={projectTypeUsage} />
      </div>
    </>
  )
}
