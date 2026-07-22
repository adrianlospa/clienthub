'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GmailConnectionPublic, Status } from '@/lib/types'
import type { WorkspaceOption } from '@/lib/workspace'
import WorkspacesSettings from './WorkspacesSettings'
import NotificationSettings from './NotificationSettings'
import GmailSettings from './GmailSettings'

export default function SettingsClient({
  statuses,
  usage,
  workspaces,
  digestEnabled,
  gmailConnection,
  gmailStatus,
}: {
  statuses: Status[]
  usage: Record<string, number>
  workspaces: WorkspaceOption[]
  digestEnabled: boolean
  gmailConnection: GmailConnectionPublic | null
  gmailStatus?: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhase, setNewPhase] = useState<'pre_sale' | 'post_sale'>('pre_sale')
  const [newColor, setNewColor] = useState('#64748b')

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

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink">Setări</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Statusurile sunt per workspace. Ordinea de aici dictează ordinea coloanelor din pipeline.
      </p>

      {error && <p className="mt-4 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</p>}

      <div className="mt-6">
        <WorkspacesSettings workspaces={workspaces} />
      </div>

      <div className="mt-6">
        <NotificationSettings digestEnabled={digestEnabled} />
      </div>

      <div className="mt-6">
        <GmailSettings connection={gmailConnection} statusParam={gmailStatus} />
      </div>

      <section className="mt-6 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Statusuri</h2>

        <div className="mt-4 space-y-2">
          {statuses.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-0">
              <input
                type="color"
                value={s.color}
                disabled={busy}
                onChange={(e) => call(`/api/statuses/${s.id}`, 'PATCH', { color: e.target.value })}
                aria-label={`Culoare pentru ${s.name}`}
                className="h-8 w-8 shrink-0 cursor-pointer rounded border border-line"
              />
              <span className="min-w-32 font-medium text-ink">{s.name}</span>
              <select
                value={s.phase}
                disabled={busy}
                onChange={(e) => call(`/api/statuses/${s.id}`, 'PATCH', { phase: e.target.value })}
                aria-label={`Faza pentru ${s.name}`}
                className="rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-accent-500"
              >
                <option value="pre_sale">Pre-vânzare</option>
                <option value="post_sale">Post-vânzare</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={s.is_won}
                  disabled={busy}
                  onChange={(e) => call(`/api/statuses/${s.id}`, 'PATCH', { is_won: e.target.checked })}
                />
                Câștigat
              </label>
              <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={s.is_lost}
                  disabled={busy}
                  onChange={(e) => call(`/api/statuses/${s.id}`, 'PATCH', { is_lost: e.target.checked })}
                />
                Pierdut
              </label>
              <span className="text-xs text-ink-faint">{usage[s.id] ?? 0} clienți</span>
              <button
                onClick={() => remove(s)}
                disabled={busy}
                className="ml-auto text-xs text-rust-600 hover:underline"
              >
                Șterge
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={addStatus} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
          <label className="text-sm font-medium text-ink">
            Status nou
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Negociere"
              className="mt-1 block rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent-500"
            />
          </label>
          <select
            value={newPhase}
            onChange={(e) => setNewPhase(e.target.value as 'pre_sale' | 'post_sale')}
            aria-label="Faza statusului nou"
            className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent-500"
          >
            <option value="pre_sale">Pre-vânzare</option>
            <option value="post_sale">Post-vânzare</option>
          </select>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            aria-label="Culoarea statusului nou"
            className="h-9 w-9 cursor-pointer rounded border border-line"
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
    </>
  )
}
