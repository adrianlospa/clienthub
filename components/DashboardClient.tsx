'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ActivityGroups, Kpis, MemberStats, PeriodStats, PipelineColumn } from '@/lib/dashboard'
import { daysOverdue } from '@/lib/dashboard'
import { formatDate, formatMoney, relativeDays } from '@/lib/fmt'
import type { ActivityWithClient, RankingWithClient } from '@/app/(app)/page'
import StatusBadge from './StatusBadge'

type FollowUp = {
  id: string
  name: string
  next_step_date: string
  next_step_description: string | null
}

export default function DashboardClient({
  overdueFollowUps,
  activityGroups,
  waitingOnClient,
  waitingOnMe,
  pipeline,
  kpis,
  period,
  teamPerformance,
  streak,
  portfolioRankings,
  currency,
}: {
  overdueFollowUps: FollowUp[]
  activityGroups: ActivityGroups<ActivityWithClient>
  waitingOnClient: ActivityWithClient[]
  waitingOnMe: ActivityWithClient[]
  pipeline: PipelineColumn[]
  kpis: Kpis
  period: PeriodStats
  teamPerformance: MemberStats[]
  streak: number
  portfolioRankings: RankingWithClient[]
  currency: string
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function markDone(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  const allOpenActivities = [
    ...activityGroups.overdue,
    ...activityGroups.today,
    ...activityGroups.thisWeek,
  ]

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink">Azi</h1>
        {streak > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-sm font-medium text-gold-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M12 2c1 3-2 4-2 7a3 3 0 0 0 6 0c1.5 1.5 2 3.5 2 5a6 6 0 0 1-12 0c0-3 2-4 3-7 .5 1 1 1.5 1.5 1.5C11 8.5 11 5 12 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {streak} {streak === 1 ? 'zi' : 'zile'} la rând
          </span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <KpiCard label="Clienți" value={String(kpis.totalClients)} />
        <KpiCard label="Oportunități active" value={String(kpis.activeOpportunities)} />
        <KpiCard label="Rată conversie" value={`${kpis.conversionRate}%`} sub={`${kpis.won} câștigați / ${kpis.lost} pierduți`} />
        <KpiCard label="Follow-up-uri depășite" value={String(kpis.overdueFollowUps)} accent={kpis.overdueFollowUps > 0} />
        <KpiCard label="Valoare pipeline activ" value={formatMoney(kpis.activePipelineValue, currency)} />
        <KpiCard label="Valoare contracte câștigate" value={formatMoney(kpis.wonValue, currency)} />
        <KpiCard label="Oferte trimise (30 zile)" value={String(period.offersSent)} />
        <KpiCard label="Contracte semnate (30 zile)" value={String(period.contractsSigned)} />
      </div>

      {portfolioRankings.length > 0 && (
        <section className="mt-6 rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Top oportunități</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Clasament AI, actualizat {relativeDays(portfolioRankings[0].computed_at)}
          </p>
          <ul className="mt-3 space-y-2">
            {portfolioRankings.map((r) => (
              <li key={r.id} className="flex gap-3 border-b border-line py-2 text-sm last:border-0">
                <span className="w-5 shrink-0 font-semibold text-accent-700">{r.rank}</span>
                <div>
                  <Link href={`/clienti/${r.client_id}`} className="font-medium text-ink hover:text-accent-700">
                    {r.clients?.name ?? 'Client'}
                  </Link>
                  {r.reasoning && <p className="text-xs text-ink-muted">{r.reasoning}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Outstanding — follow-up-uri depășite</h2>
        {overdueFollowUps.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nimic scadent azi.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {overdueFollowUps.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-0">
                <Link href={`/clienti/${c.id}`} className="font-medium text-ink hover:text-accent-700">
                  {c.name}
                </Link>
                <span className="text-sm text-ink-muted">{c.next_step_description ?? '—'}</span>
                <span className="ml-auto text-sm font-medium text-rust-600">
                  {formatDate(c.next_step_date)} · {daysOverdue(c.next_step_date)} zile
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Activități — azi și săptămâna asta</h2>
        {allOpenActivities.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nicio activitate cu termen în următoarele 7 zile.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {activityGroups.overdue.length > 0 && (
              <ActivityGroup title="Depășite" items={activityGroups.overdue} busyId={busyId} onDone={markDone} overdue />
            )}
            {activityGroups.today.length > 0 && (
              <ActivityGroup title="Azi" items={activityGroups.today} busyId={busyId} onDone={markDone} />
            )}
            {activityGroups.thisWeek.length > 0 && (
              <ActivityGroup title="Săptămâna asta" items={activityGroups.thisWeek} busyId={busyId} onDone={markDone} />
            )}
          </div>
        )}
      </section>

      <div className="mt-6 grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Așteaptă clientul</h2>
          {waitingOnClient.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Nimic în așteptare.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {waitingOnClient.map((a) => (
                <WaitingRow key={a.id} activity={a} />
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Aștept eu</h2>
          {waitingOnMe.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Nimic în așteptare.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {waitingOnMe.map((a) => (
                <WaitingRow key={a.id} activity={a} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Pipeline</h2>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {pipeline.map((col) => (
            <Link
              key={col.status.id}
              href={`/clienti?status=${col.status.id}`}
              className="flex w-40 shrink-0 flex-col rounded-lg border border-line p-3 transition hover:border-accent-500"
            >
              <StatusBadge name={col.status.name} color={col.status.color} compact />
              <span className="mt-2 font-display text-xl tabular-nums text-ink">{col.count}</span>
              <span className="font-data text-xs text-ink-muted">{formatMoney(col.totalValue, currency)}</span>
            </Link>
          ))}
        </div>
      </section>

      {teamPerformance.length > 1 && (
        <section className="mt-6 rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Performanță echipă</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Membru</th>
                  <th className="py-2 pr-4 font-medium">Clienți activi</th>
                  <th className="py-2 pr-4 font-medium">Câștigați</th>
                  <th className="py-2 pr-4 font-medium">Pierduți</th>
                  <th className="py-2 pr-4 font-medium">Finalizate (7 zile)</th>
                  <th className="py-2 pr-4 font-medium">Depășite</th>
                </tr>
              </thead>
              <tbody>
                {teamPerformance.map((m) => (
                  <tr key={m.userId} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 text-ink">{m.email}</td>
                    <td className="py-2 pr-4">{m.activeClients}</td>
                    <td className="py-2 pr-4">{m.won}</td>
                    <td className="py-2 pr-4">{m.lost}</td>
                    <td className="py-2 pr-4">{m.completedThisWeek}</td>
                    <td className={`py-2 pr-4 ${m.overdue > 0 ? 'font-medium text-rust-600' : ''}`}>{m.overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}

function KpiCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="font-data text-[10px] uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl tabular-nums ${accent ? 'text-rust-600' : 'text-ink'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
    </div>
  )
}

function ActivityGroup({
  title,
  items,
  busyId,
  onDone,
  overdue = false,
}: {
  title: string
  items: ActivityWithClient[]
  busyId: string | null
  onDone: (id: string) => void
  overdue?: boolean
}) {
  return (
    <div>
      <h3 className={`text-xs font-medium uppercase tracking-wide ${overdue ? 'text-rust-600' : 'text-ink-faint'}`}>
        {title}
      </h3>
      <ul className="mt-1 space-y-1.5">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={busyId === a.id}
              onChange={() => onDone(a.id)}
              aria-label={`Marchează „${a.title}" ca gata`}
            />
            <span className="text-ink">{a.title}</span>
            {a.clients?.name && (
              <Link href={`/clienti/${a.client_id}`} className="text-xs text-accent-700 hover:underline">
                {a.clients.name}
              </Link>
            )}
            <span className={`text-xs ${overdue ? 'font-medium text-rust-600' : 'text-ink-faint'}`}>
              {formatDate(a.due_date)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function WaitingRow({ activity }: { activity: ActivityWithClient }) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink">{activity.title}</span>
      {activity.clients?.name && (
        <Link href={`/clienti/${activity.client_id}`} className="text-xs text-accent-700 hover:underline">
          {activity.clients.name}
        </Link>
      )}
      <span className="ml-auto text-xs text-ink-faint">{relativeDays(activity.due_date ?? activity.created_at)}</span>
    </li>
  )
}
