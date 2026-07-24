'use client'

import { useState } from 'react'
import type { Project } from '@/lib/types'

const TYPE_LABELS: Record<Project['type'], string> = {
  website: 'Website',
  video: 'Video',
  course: 'Curs',
  campaign: 'Campanie',
  internal: 'Intern',
}

export default function ProjectFormModal({
  project = null,
  onClose,
  onSaved,
}: {
  project?: Project | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [type, setType] = useState<Project['type']>(project?.type ?? 'website')
  const [description, setDescription] = useState(project?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(project ? `/api/projects/${project.id}` : '/api/projects', {
        method: project ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, description: description.trim() || null }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Salvarea a eșuat.')
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {project ? 'Editează proiectul' : 'Proiect nou'}
        </h2>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Nume *
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Tip
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Project['type'])}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-500"
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Descriere
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Anulează
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700 disabled:opacity-60"
          >
            {saving ? 'Se salvează…' : 'Salvează'}
          </button>
        </div>
      </form>
    </div>
  )
}
