'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Interaction } from '@/lib/types'
import { formatDate } from '@/lib/fmt'

const CHANNEL_LABELS: Record<Interaction['channel'], string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  phone: 'Telefon',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  in_person: 'Față în față',
}

export default function InteractionsPanel({
  clientId,
  interactions,
}: {
  clientId: string
  interactions: Interaction[]
}) {
  const router = useRouter()
  const [logging, setLogging] = useState(false)
  const [channel, setChannel] = useState<Interaction['channel']>('whatsapp')
  const [direction, setDirection] = useState<'in' | 'out'>('out')
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, channel, direction, summary }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Salvarea a eșuat.')
        return
      }
      setSummary('')
      setLogging(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Discuții</h2>
        {!logging && (
          <button
            onClick={() => setLogging(true)}
            className="text-xs font-medium text-accent-700 hover:underline"
          >
            + Log interacțiune
          </button>
        )}
      </div>

      {logging && (
        <form onSubmit={submit} className="mt-3 space-y-2 rounded-lg border border-line p-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Interaction['channel'])}
              aria-label="Canal"
              className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-accent-500"
            >
              {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'in' | 'out')}
              aria-label="Direcție"
              className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-accent-500"
            >
              <option value="out">Trimis</option>
              <option value="in">Primit</option>
            </select>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Ce s-a discutat…"
            rows={2}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
          {error && <p className="text-sm text-rust-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLogging(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-ink-muted hover:bg-paper"
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

      {interactions.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Nicio discuție logată încă.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {interactions.map((i) => (
            <li key={i.id} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-muted">
                  {CHANNEL_LABELS[i.channel]}
                </span>
                <span className="text-xs text-ink-faint">
                  {i.direction === 'out' ? 'trimis' : 'primit'} · {formatDate(i.occurred_at)}
                </span>
              </div>
              {i.summary && <p className="mt-1 text-ink">{i.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
