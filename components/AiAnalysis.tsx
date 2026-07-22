'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AiAnalysis({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [streaming, setStreaming] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function analyze() {
    setStreaming(true)
    setError(null)
    setText('')
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (!res.ok || !res.body) {
        setError(await res.text())
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setText(acc)
      }
      router.refresh()
    } finally {
      setStreaming(false)
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Analiză AI</h2>
        <button
          onClick={analyze}
          disabled={streaming}
          className="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-60"
        >
          {streaming ? 'Se analizează…' : 'Analizează clientul'}
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</p>}

      {text && (
        <div className="mt-3 whitespace-pre-wrap rounded-lg bg-paper p-3 text-sm text-ink">
          {text}
        </div>
      )}

      {!text && !streaming && !error && (
        <p className="mt-3 text-sm text-ink-muted">
          Trimite tot istoricul clientului către Claude pentru un rezumat, riscuri și pași
          recomandați. Rezultatul se salvează automat ca notiță AI.
        </p>
      )}
    </section>
  )
}
