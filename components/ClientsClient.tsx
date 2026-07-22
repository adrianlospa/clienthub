'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Client, Status } from '@/lib/types'
import { formatDate, formatMoney } from '@/lib/fmt'
import ClientFormModal from './ClientFormModal'
import StatusBadge from './StatusBadge'

export default function ClientsClient({
  workspaceId,
  clients,
  statuses,
  currency,
  initialStatusFilter = '',
}: {
  workspaceId: string
  clients: Client[]
  statuses: Status[]
  currency: string
  initialStatusFilter?: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter)
  const [creating, setCreating] = useState(false)

  const statusById = useMemo(
    () => new Map(statuses.map((s) => [s.id, s])),
    [statuses]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter((c) => {
      if (statusFilter && c.current_status_id !== statusFilter) return false
      if (!q) return true
      return [c.name, c.company_name, c.email, c.phone, c.contact_person]
        .some((v) => v?.toLowerCase().includes(q))
    })
  }, [clients, query, statusFilter])

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink">Clienți</h1>
        <span className="rounded-full bg-paper px-2.5 py-0.5 text-sm text-ink-muted">
          {clients.length}
        </span>
        <button
          onClick={() => setCreating(true)}
          className="ml-auto rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700"
        >
          + Client nou
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caută după nume, firmă, email, telefon…"
          className="min-w-64 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrează după status"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent-500"
        >
          <option value="">Toate statusurile</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {clients.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-ink-muted">
          Niciun client nu se potrivește cu filtrele.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Nume</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Valoare estimată</th>
                <th className="px-4 py-3 font-medium">Pas următor</th>
                <th className="px-4 py-3 font-medium">Adăugat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const status = c.current_status_id ? statusById.get(c.current_status_id) : null
                const overdue =
                  c.next_step_date !== null &&
                  new Date(c.next_step_date) < new Date(new Date().toDateString())
                return (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-3">
                      <Link href={`/clienti/${c.id}`} className="font-medium text-ink hover:text-accent-700">
                        {c.name}
                      </Link>
                      {c.company_name && (
                        <div className="text-xs text-ink-muted">{c.company_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {status ? (
                        <StatusBadge name={status.name} color={status.color} compact />
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink">
                      {formatMoney(c.estimated_value, c.currency || currency)}
                    </td>
                    <td className="px-4 py-3">
                      {c.next_step_date ? (
                        <span className={overdue ? 'font-medium text-rust-600' : 'text-ink'}>
                          {formatDate(c.next_step_date)}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                      {c.next_step_description && (
                        <div className="max-w-56 truncate text-xs text-ink-muted">
                          {c.next_step_description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(c.date_added)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <ClientFormModal
          workspaceId={workspaceId}
          statuses={statuses}
          currency={currency}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-10 rounded-lg border border-line bg-surface px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-ink">Niciun client încă</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
        Adaugă primul client ca să începi să urmărești statusuri, pași următori și istoricul
        discuțiilor.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700"
      >
        + Adaugă primul client
      </button>
    </div>
  )
}
