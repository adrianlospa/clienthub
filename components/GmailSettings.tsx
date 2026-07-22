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
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Gmail</h2>
      <p className="mt-1 text-sm text-slate-500">
        Conectează-ți contul ca să aduci email-urile din ultimele 30 zile în istoricul clienților
        și să trimiți direct din ClientHub.
      </p>

      {banner && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${banner.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {banner.text}
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {syncResult && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{syncResult}</p>}

      {connection ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-700">
            Conectat: <span className="font-medium">{connection.email}</span>
          </span>
          <span className="text-xs text-slate-400">din {formatDate(connection.created_at)}</span>
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
            className="text-xs text-red-600 hover:underline"
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
