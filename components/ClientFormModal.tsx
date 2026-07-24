'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Client, DuplicateMatch, Status } from '@/lib/types'

type Draft = {
  name: string
  company_name: string
  contact_person: string
  phone: string
  email: string
  whatsapp: string
  instagram: string
  facebook: string
  linkedin: string
  source: string
  tags: string
  current_status_id: string
  estimated_value: string
  date_first_contacted: string
  next_step_date: string
  next_step_description: string
}

function toDraft(client: Client | null, statuses: Status[]): Draft {
  return {
    name: client?.name ?? '',
    company_name: client?.company_name ?? '',
    contact_person: client?.contact_person ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    whatsapp: client?.whatsapp ?? '',
    instagram: client?.instagram ?? '',
    facebook: client?.facebook ?? '',
    linkedin: client?.linkedin ?? '',
    source: client?.source ?? '',
    tags: client?.tags?.join(', ') ?? '',
    current_status_id: client?.current_status_id ?? statuses[0]?.id ?? '',
    estimated_value: client?.estimated_value?.toString() ?? '',
    date_first_contacted: client?.date_first_contacted ?? '',
    next_step_date: client?.next_step_date ?? '',
    next_step_description: client?.next_step_description ?? '',
  }
}

export default function ClientFormModal({
  workspaceId,
  statuses,
  currency,
  client = null,
  onClose,
  onSaved,
}: {
  workspaceId: string
  statuses: Status[]
  currency: string
  client?: Client | null
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(client, statuses))
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backdropMouseDown = useRef(false)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  // Verificarea de duplicate rulează debounced în timp ce scrii, ca avertismentul
  // să apară înainte de submit, nu după.
  useEffect(() => {
    if (!draft.name.trim() && !draft.email.trim() && !draft.phone.trim()) {
      setDuplicates([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/clients/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: draft.name,
            email: draft.email,
            phone: draft.phone,
            excludeId: client?.id ?? null,
          }),
        })
        if (!res.ok) return
        const body = await res.json()
        setDuplicates(body.duplicates ?? [])
      } catch {
        // Verificarea de duplicate e best-effort; nu blochează formularul.
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [draft.name, draft.email, draft.phone, client?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const payload = {
        workspace_id: workspaceId,
        name: draft.name.trim(),
        company_name: draft.company_name.trim() || null,
        contact_person: draft.contact_person.trim() || null,
        phone: draft.phone.trim() || null,
        email: draft.email.trim().toLowerCase() || null,
        whatsapp: draft.whatsapp.trim() || null,
        instagram: draft.instagram.trim() || null,
        facebook: draft.facebook.trim() || null,
        linkedin: draft.linkedin.trim() || null,
        source: draft.source.trim() || null,
        tags: draft.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        current_status_id: draft.current_status_id || null,
        estimated_value: draft.estimated_value ? Number(draft.estimated_value) : null,
        date_first_contacted: draft.date_first_contacted || null,
        next_step_date: draft.next_step_date || null,
        next_step_description: draft.next_step_description.trim() || null,
      }

      const res = await fetch(client ? `/api/clients/${client.id}` : '/api/clients', {
        method: client ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const showDuplicates = duplicates.length > 0 && !dismissedDuplicates

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4"
      onMouseDown={(e: MouseEvent) => {
        backdropMouseDown.current = e.target === e.currentTarget
      }}
      onClick={(e: MouseEvent) => {
        if (backdropMouseDown.current && e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {client ? 'Editează clientul' : 'Client nou'}
        </h2>

        {showDuplicates && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-amber-900">Posibil duplicat</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                  {duplicates.map((d) => (
                    <li key={d.id}>
                      <a href={`/clienti/${d.id}`} className="font-medium underline">
                        {d.name}
                      </a>
                      {d.company_name ? ` · ${d.company_name}` : ''}
                      <span className="ml-1 text-xs text-amber-700">
                        ({d.match_reason === 'email'
                          ? 'același email'
                          : d.match_reason === 'phone'
                            ? 'același telefon'
                            : 'nume similar'})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setDismissedDuplicates(true)}
                className="shrink-0 text-xs font-medium text-amber-900 underline"
              >
                Ignoră
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Nume *" span2>
            <input
              required
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Firmă">
            <input value={draft.company_name} onChange={(e) => set('company_name', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Persoană de contact">
            <input value={draft.contact_person} onChange={(e) => set('contact_person', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Email">
            <input type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Telefon">
            <input value={draft.phone} onChange={(e) => set('phone', e.target.value)} className={inputClass} />
          </Field>
          <Field label="WhatsApp">
            <input value={draft.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Sursă">
            <input value={draft.source} onChange={(e) => set('source', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Instagram">
            <input value={draft.instagram} onChange={(e) => set('instagram', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Facebook">
            <input value={draft.facebook} onChange={(e) => set('facebook', e.target.value)} className={inputClass} />
          </Field>
          <Field label="LinkedIn" span2>
            <input value={draft.linkedin} onChange={(e) => set('linkedin', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Status">
            <select
              value={draft.current_status_id}
              onChange={(e) => set('current_status_id', e.target.value)}
              className={inputClass}
            >
              <option value="">— fără status —</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Valoare estimată (${currency}, net)`}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.estimated_value}
              onChange={(e) => set('estimated_value', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Primul contact">
            <input type="date" value={draft.date_first_contacted} onChange={(e) => set('date_first_contacted', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Data pasului următor">
            <input type="date" value={draft.next_step_date} onChange={(e) => set('next_step_date', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Pasul următor" span2>
            <input
              value={draft.next_step_description}
              onChange={(e) => set('next_step_description', e.target.value)}
              placeholder="Ex: trimit oferta revizuită"
              className={inputClass}
            />
          </Field>
          <Field label="Etichete (separate prin virgulă)" span2>
            <input value={draft.tags} onChange={(e) => set('tags', e.target.value)} className={inputClass} />
          </Field>
        </div>

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

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent-500'

function Field({
  label,
  span2 = false,
  children,
}: {
  label: string
  span2?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`block text-sm font-medium text-slate-700 ${span2 ? 'col-span-2 max-sm:col-span-1' : ''}`}>
      {label}
      {children}
    </label>
  )
}
