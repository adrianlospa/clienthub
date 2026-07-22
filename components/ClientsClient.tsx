'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Client, Status } from '@/lib/types'
import { formatDate, formatMoney } from '@/lib/fmt'
import ClientFormModal from './ClientFormModal'

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
        <h1 className="text-2xl font-semibold text-slate-900">Clienți</h1>
        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-sm text-slate-600">
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
          className="min-w-64 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrează după status"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-500"
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
        <p className="mt-10 text-center text-sm text-slate-500">
          Niciun client nu se potrivește cu filtrele.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
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
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/clienti/${c.id}`} className="font-medium text-slate-900 hover:text-accent-700">
                        {c.name}
                      </Link>
                      {c.company_name && (
                        <div className="text-xs text-slate-500">{c.company_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {status ? (
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: status.color }}
                        >
                          {status.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {formatMoney(c.estimated_value, c.currency || currency)}
                    </td>
                    <td className="px-4 py-3">
                      {c.next_step_date ? (
                        <span className={overdue ? 'font-medium text-red-600' : 'text-slate-700'}>
                          {formatDate(c.next_step_date)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {c.next_step_description && (
                        <div className="max-w-56 truncate text-xs text-slate-500">
                          {c.next_step_description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(c.date_added)}</td>
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
    <div className="mt-10 rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Niciun client încă</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
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
