'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Comment } from '@/lib/types'
import { formatDate } from '@/lib/fmt'

export default function CommentsPanel({
  parentType,
  parentId,
  comments,
}: {
  parentType: 'client' | 'project' | 'activity'
  parentId: string
  comments: Comment[]
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentType, parentId, text }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Salvarea a eșuat.')
        return
      }
      setText('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Notițe</h2>

      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Adaugă o notiță…"
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-500"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="self-end rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-60"
        >
          Adaugă
        </button>
      </form>

      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nicio notiță încă.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="whitespace-pre-wrap text-slate-700">{c.text}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(c.created_at)}
                {c.is_ai && ' · AI'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
