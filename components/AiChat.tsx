'use client'

import { useState } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }

export default function AiChat({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || streaming) return

    const nextMessages: Message[] = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)
    setInput('')
    setStreaming(true)
    setError(null)

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, messages: nextMessages }),
      })
      if (!res.ok || !res.body) {
        setError(await res.text())
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      setMessages([...nextMessages, { role: 'assistant', content: '' }])
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages([...nextMessages, { role: 'assistant', content: acc }])
      }
    } finally {
      setStreaming(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Întreabă despre acest client</h2>
        {!open && (
          <button onClick={() => setOpen(true)} className="text-xs font-medium text-accent-700 hover:underline">
            Deschide chat
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {messages.length > 0 && (
            <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <span
                    className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-sm ${
                      m.role === 'user' ? 'bg-accent-600 text-white' : 'bg-white text-slate-700 shadow-sm'
                    }`}
                  >
                    {m.content || '…'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <form onSubmit={send} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex: Când am vorbit ultima dată cu el?"
              disabled={streaming}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-500"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="rounded-lg bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-60"
            >
              Trimite
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
