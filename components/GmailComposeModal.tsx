'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GmailComposeModal({
  clientId,
  to,
  onClose,
}: {
  clientId: string
  to: string
  onClose: () => void
}) {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body, clientId }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? 'Trimiterea a eșuat.')
        return
      }
      router.refresh()
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={send}
        className="my-8 w-full max-w-lg rounded-lg border border-line bg-surface p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-ink">Trimite prin Gmail</h2>
        <p className="mt-1 text-sm text-ink-muted">Către: {to}</p>

        <label className="mt-4 block text-sm font-medium text-ink">
          Subiect
          <input
            required
            autoFocus
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-ink">
          Mesaj
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>

        {error && <p className="mt-4 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-ink-muted hover:bg-paper">
            Anulează
          </button>
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {sending ? 'Se trimite…' : 'Trimite'}
          </button>
        </div>
      </form>
    </div>
  )
}
