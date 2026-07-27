'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectType } from '@/lib/types'

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export default function ProjectTypesSettings({
  projectTypes,
  usage,
}: {
  projectTypes: ProjectType[]
  usage: Record<string, number>
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#64748b')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

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

  async function addType(e: React.FormEvent) {
    e.preventDefault()
    const maxOrder = projectTypes.reduce((m, t) => Math.max(m, t.sort_order), 0)
    const key = slugify(newLabel)
    if (!key) return
    const ok = await call('/api/project-types', 'POST', {
      key,
      label: newLabel.trim(),
      color: newColor,
      sort_order: maxOrder + 10,
    })
    if (ok) setNewLabel('')
  }

  async function remove(type: ProjectType) {
    const count = usage[type.key] ?? 0
    const msg = count
      ? `„${type.label}" e folosit de ${count} ${count === 1 ? 'proiect' : 'proiecte'}. Acestea rămân cu tipul curent. Ștergi?`
      : `Ștergi tipul „${type.label}"?`
    if (!confirm(msg)) return
    await call(`/api/project-types/${type.id}`, 'DELETE')
  }

  async function rename(type: ProjectType) {
    if (!editingLabel.trim() || editingLabel.trim() === type.label) {
      setEditingId(null)
      return
    }
    const ok = await call(`/api/project-types/${type.id}`, 'PATCH', { label: editingLabel.trim() })
    if (ok) setEditingId(null)
  }

  async function move(type: ProjectType, direction: 'up' | 'down') {
    const idx = projectTypes.findIndex((t) => t.id === type.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= projectTypes.length) return
    const other = projectTypes[swapIdx]
    setBusy(true)
    setError(null)
    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/project-types/${type.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: other.sort_order }),
        }),
        fetch(`/api/project-types/${other.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: type.sort_order }),
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
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Tipuri de proiect</h2>
      <p className="mt-1 text-sm text-slate-500">
        Tipurile sunt per workspace. Ordinea de aici dictează ordinea din formularul de proiect.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 space-y-2">
        {projectTypes.map((t, idx) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 border-b border-slate-50 py-2 last:border-0">
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => move(t, 'up')}
                disabled={busy || idx === 0}
                aria-label={`Mută „${t.label}" mai sus`}
                className="leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(t, 'down')}
                disabled={busy || idx === projectTypes.length - 1}
                aria-label={`Mută „${t.label}" mai jos`}
                className="leading-none text-slate-400 hover:text-slate-700 disabled:opacity-30"
              >
                ▼
              </button>
            </div>
            <input
              type="color"
              value={t.color}
              disabled={busy}
              onChange={(e) => call(`/api/project-types/${t.id}`, 'PATCH', { color: e.target.value })}
              aria-label={`Culoare pentru ${t.label}`}
              className="h-8 w-8 shrink-0 cursor-pointer rounded border border-slate-200"
            />
            {editingId === t.id ? (
              <input
                autoFocus
                value={editingLabel}
                onChange={(e) => setEditingLabel(e.target.value)}
                onBlur={() => rename(t)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') rename(t)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-accent-500"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingId(t.id)
                  setEditingLabel(t.label)
                }}
                className="min-w-0 break-words text-left font-medium text-slate-800 hover:underline"
                title="Redenumește"
              >
                {t.label}
              </button>
            )}
            <span className="text-xs text-slate-400">{usage[t.key] ?? 0} proiecte</span>
            <button
              onClick={() => remove(t)}
              disabled={busy}
              className="ml-auto text-xs text-red-600 hover:underline"
            >
              Șterge
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={addType} className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5">
        <label className="text-sm font-medium text-slate-700">
          Tip nou
          <input
            required
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Ex: Podcast"
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          aria-label="Culoarea tipului nou"
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
  )
}
