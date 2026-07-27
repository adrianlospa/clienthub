'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Activity, ActivityType, WorkspaceMember } from '@/lib/types'
import { formatDate } from '@/lib/fmt'

export default function ActivitiesPanel({
  clientId = null,
  projectId = null,
  activities,
  activityTypes,
  members,
  currentUserId,
}: {
  clientId?: string | null
  projectId?: string | null
  activities: Activity[]
  activityTypes: ActivityType[]
  members: WorkspaceMember[]
  currentUserId: string
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState(activityTypes[0]?.key ?? 'task')
  const [dueDate, setDueDate] = useState('')
  const [assignedTo, setAssignedTo] = useState(currentUserId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const typeByKey = useMemo(() => new Map(activityTypes.map((t) => [t.key, t])), [activityTypes])
  const memberByUserId = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members])

  const sorted = useMemo(() => {
    return [...activities].sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (a.status !== 'done' && b.status === 'done') return -1
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity
      return ad - bd
    })
  }, [activities])

  async function createActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          projectId,
          client_id: clientId,
          project_id: projectId,
          type,
          title: title.trim(),
          due_date: dueDate || null,
          assigned_to: assignedTo,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Salvarea a eșuat.')
        return
      }
      setTitle('')
      setDueDate('')
      setCreating(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(activity: Activity, status: Activity['status']) {
    setBusyId(activity.id)
    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function toggleWaitingOn(activity: Activity) {
    const next = activity.waiting_on === 'client' ? 'me' : 'client'
    setBusyId(activity.id)
    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiting_on: next }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(activity: Activity) {
    if (!confirm(`Ștergi activitatea „${activity.title}"?`)) return
    setBusyId(activity.id)
    try {
      const res = await fetch(`/api/activities/${activity.id}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Activități</h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="text-xs font-medium text-accent-700 hover:underline"
          >
            + Activitate nouă
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={createActivity} className="mt-3 space-y-2 rounded-lg border border-slate-100 p-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titlu activitate"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="Tip activitate"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-accent-500"
            >
              {activityTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Termen"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-accent-500"
            />
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              aria-label="Responsabil"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-accent-500"
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userId === currentUserId ? 'Eu' : m.email}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-60"
            >
              Salvează
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nicio activitate încă.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((a) => {
            const t = typeByKey.get(a.type)
            const assignee = a.assigned_to ? memberByUserId.get(a.assigned_to) : null
            const overdue =
              a.status !== 'done' && a.due_date && new Date(a.due_date) < new Date(new Date().toDateString())
            return (
              <li
                key={a.id}
                className={`flex items-start gap-2 border-b border-slate-50 py-2 text-sm last:border-0 ${
                  a.status === 'done' ? 'opacity-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={a.status === 'done'}
                  disabled={busyId === a.id}
                  onChange={(e) => updateStatus(a, e.target.checked ? 'done' : 'todo')}
                  aria-label={`Marchează „${a.title}" ca gata`}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`min-w-0 break-words ${a.status === 'done' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                    {a.title}
                  </span>
                  {t && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs text-white"
                      style={{ backgroundColor: t.color }}
                    >
                      {t.label}
                    </span>
                  )}
                  {a.due_date && (
                    <span className={`shrink-0 text-xs ${overdue ? 'font-medium text-red-600' : 'text-slate-400'}`}>
                      {formatDate(a.due_date)}
                    </span>
                  )}
                  {assignee && (
                    <span className="shrink-0 text-xs text-slate-400">
                      {assignee.userId === currentUserId ? 'eu' : assignee.email}
                    </span>
                  )}
                  {clientId && (
                    <button
                      onClick={() => toggleWaitingOn(a)}
                      disabled={busyId === a.id}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        a.waiting_on === 'client'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {a.waiting_on === 'client' ? 'așteaptă clientul' : 'aștept eu'}
                    </button>
                  )}
                  <button
                    onClick={() => remove(a)}
                    disabled={busyId === a.id}
                    className="ml-auto shrink-0 text-xs text-red-600 hover:underline"
                  >
                    Șterge
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
