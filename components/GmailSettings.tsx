'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GmailConnectionPublic } from '@/lib/types'
import { formatDate } from '@/lib/fmt'

const STATUS_MESSAGES: Record<string, { text: string; error: boolean }> = {
  connected: { text: 'Cont Gmail conectat cu succes.', error: false },
  error: { text: 'Conectarea a eșuat. Încearcă din nou.', error: true },
  state_mismatch: { text: 'Sesiune de autorizare invalidă. Încearcă din nou.', error: true },
  no_refresh_token: {
    text: 'Google nu a returnat un token de reînnoire. Revocă accesul din contul Google și reîncearcă.',
    error: true,
  },
}

export default function GmailSettings({
  connection,
  statusParam,
}: {
  connection: GmailConnectionPublic | null
  statusParam?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const banner = statusParam ? STATUS_MESSAGES[statusParam] : null

  async function disconnect() {
    if (!connection || !confirm(`Deconectezi ${connection.email}?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/gmail/connections/${connection.id}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function sync() {
    setBusy(true)
    setError(null)
    setSyncResult(null)
    try {
      const res = await fetch('/api/gmail/sync', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Sincronizarea a eșuat.')
        return
      }
      setSyncResult(`${body.imported} email-uri noi importate (din ${body.scanned} găsite).`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Gmail</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Conectează-ți contul ca să aduci email-urile din ultimele 30 zile în istoricul clienților
        și să trimiți direct din ClientHub.
      </p>

      {banner && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${banner.error ? 'bg-rust-50 text-rust-700' : 'bg-accent-50 text-accent-700'}`}>
          {banner.text}
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</p>}
      {syncResult && <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-700">{syncResult}</p>}

      {connection ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink">
            Conectat: <span className="font-medium">{connection.email}</span>
          </span>
          <span className="text-xs text-ink-faint">din {formatDate(connection.created_at)}</span>
          <button
            onClick={sync}
            disabled={busy}
            className="ml-auto rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-60"
          >
            {busy ? 'Se sincronizează…' : 'Sincronizează'}
          </button>
          <button
            onClick={disconnect}
            disabled={busy}
            className="text-xs text-rust-600 hover:underline"
          >
            Deconectează
          </button>
        </div>
      ) : (
        <a
          href="/api/gmail/connect"
          className="mt-4 inline-block rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
        >
          Conectează Gmail
        </a>
      )}
    </section>
  )
}
