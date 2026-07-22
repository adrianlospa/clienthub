'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type {
  Activity,
  ActivityType,
  Client,
  ClientDocument,
  Comment,
  Interaction,
  Status,
  StatusHistoryEntry,
  WorkspaceMember,
} from '@/lib/types'
import { formatDate, formatMoney, mailtoLink, relativeDays, waLink } from '@/lib/fmt'
import ClientFormModal from './ClientFormModal'
import InteractionsPanel from './InteractionsPanel'
import CommentsPanel from './CommentsPanel'
import DocumentsPanel from './DocumentsPanel'
import ActivitiesPanel from './ActivitiesPanel'
import AiAnalysis from './AiAnalysis'
import AiChat from './AiChat'
import GmailComposeModal from './GmailComposeModal'
import StatusBadge from './StatusBadge'

export default function ClientDetailClient({
  workspaceId,
  client,
  statuses,
  history,
  interactions,
  comments,
  documents,
  activities,
  activityTypes,
  members,
  currentUserId,
  currency,
  hasGmailConnection,
}: {
  workspaceId: string
  client: Client
  statuses: Status[]
  history: StatusHistoryEntry[]
  interactions: Interaction[]
  comments: Comment[]
  documents: ClientDocument[]
  activities: Activity[]
  activityTypes: ActivityType[]
  members: WorkspaceMember[]
  currentUserId: string
  currency: string
  hasGmailConnection: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [composing, setComposing] = useState(false)

  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses])
  const status = client.current_status_id ? statusById.get(client.current_status_id) : null

  // Cât timp stă clientul în statusul curent — semnalul de „a stagnat".
  const daysInStatus = history[0] ? relativeDays(history[0].changed_at) : null

  async function changeStatus(statusId: string) {
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_status_id: statusId || null }),
      })
      if (res.ok) router.refresh()
    } finally {
      setSavingStatus(false)
    }
  }

  const wa = waLink(client.whatsapp ?? client.phone)
  const mail = mailtoLink(client.email, `${client.name} — ClientHub`)

  return (
    <>
      <Link href="/clienti" className="text-sm text-ink-muted hover:text-ink">
        ← Înapoi la clienți
      </Link>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{client.name}</h1>
          {client.company_name && <p className="text-ink-muted">{client.company_name}</p>}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="ml-auto rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
        >
          Editează
        </button>
      </div>

      {/* Butoane de contact — deep links, fără integrare (Phase 1, spec §8). */}
      <div className="mt-4 flex flex-wrap gap-2">
        {mail && <ContactButton href={mail} label="Trimite email" />}
        {hasGmailConnection && client.email && (
          <button
            onClick={() => setComposing(true)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-accent-500 hover:text-accent-700"
          >
            Trimite prin Gmail
          </button>
        )}
        {wa && <ContactButton href={wa} label="WhatsApp" external />}
        {client.phone && <ContactButton href={`tel:${client.phone}`} label={client.phone} />}
        {client.instagram && <ContactButton href={client.instagram} label="Instagram" external />}
        {client.facebook && <ContactButton href={client.facebook} label="Facebook" external />}
        {client.linkedin && <ContactButton href={client.linkedin} label="LinkedIn" external />}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-6 max-lg:grid-cols-1">
        <div className="col-span-2 space-y-6 max-lg:col-span-1">
          <Card title="Status">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={client.current_status_id ?? ''}
                disabled={savingStatus}
                onChange={(e) => changeStatus(e.target.value)}
                aria-label="Schimbă statusul"
                className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent-500"
              >
                <option value="">— fără status —</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {status && daysInStatus && (
                <span className="text-sm text-ink-muted">în acest status de {daysInStatus}</span>
              )}
            </div>
          </Card>

          <Card title="Istoric status">
            {history.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Niciun istoric încă. Schimbă statusul și apare aici automat.
              </p>
            ) : (
              <ol className="space-y-3">
                {history.map((h) => {
                  const from = h.from_status_id ? statusById.get(h.from_status_id) : null
                  const to = h.to_status_id ? statusById.get(h.to_status_id) : null
                  return (
                    <li key={h.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="w-24 shrink-0 text-ink-faint">{formatDate(h.changed_at)}</span>
                      {from ? <StatusPill status={from} /> : <span className="text-ink-faint">nou</span>}
                      <span className="text-ink-faint">→</span>
                      {to ? <StatusPill status={to} /> : <span className="text-ink-faint">—</span>}
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>

          <ActivitiesPanel
            clientId={client.id}
            activities={activities}
            activityTypes={activityTypes}
            members={members}
            currentUserId={currentUserId}
          />

          <AiAnalysis clientId={client.id} />

          <AiChat clientId={client.id} />

          <InteractionsPanel clientId={client.id} interactions={interactions} />

          <CommentsPanel parentType="client" parentId={client.id} comments={comments} />

          <DocumentsPanel
            workspaceId={workspaceId}
            parentType="client"
            parentId={client.id}
            documents={documents}
          />
        </div>

        <div className="space-y-6">
          <Card title="Detalii">
            <dl className="space-y-3 text-sm">
              <Row label="Valoare estimată (net)" value={formatMoney(client.estimated_value, client.currency || currency)} />
              <Row label="Persoană de contact" value={client.contact_person ?? '—'} />
              <Row label="Email" value={client.email ?? '—'} />
              <Row label="Telefon" value={client.phone ?? '—'} />
              <Row label="Sursă" value={client.source ?? '—'} />
              <Row label="Adăugat" value={formatDate(client.date_added)} />
              <Row label="Primul contact" value={formatDate(client.date_first_contacted)} />
            </dl>
            {client.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {client.tags.map((t) => (
                  <span key={t} className="rounded-full bg-paper px-2.5 py-0.5 text-xs text-ink-muted">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card title="Pasul următor">
            {client.next_step_date || client.next_step_description ? (
              <>
                <p className="text-sm text-ink">{client.next_step_description ?? '—'}</p>
                {client.next_step_date && (
                  <p className="mt-1 text-sm text-ink-muted">
                    {formatDate(client.next_step_date)} · {relativeDays(client.next_step_date)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                Niciun pas următor stabilit. Adaugă unul ca să apară pe „Azi".
              </p>
            )}
          </Card>
        </div>
      </div>

      {editing && (
        <ClientFormModal
          workspaceId={workspaceId}
          statuses={statuses}
          currency={currency}
          client={client}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            router.refresh()
          }}
        />
      )}

      {composing && client.email && (
        <GmailComposeModal clientId={client.id} to={client.email} onClose={() => setComposing(false)} />
      )}
    </>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  )
}

function StatusPill({ status }: { status: Status }) {
  return <StatusBadge name={status.name} color={status.color} />
}

function ContactButton({
  href,
  label,
  external = false,
}: {
  href: string
  label: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-accent-500 hover:text-accent-700"
    >
      {label}
    </a>
  )
}
