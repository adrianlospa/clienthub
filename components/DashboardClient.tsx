'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ActivityGroups, Kpis, MemberStats, PeriodStats, PipelineColumn } from '@/lib/dashboard'
import { daysOverdue } from '@/lib/dashboard'
import { formatDate, formatMoney, relativeDays } from '@/lib/fmt'
import type { ActivityWithClient, RankingWithClient } from '@/app/(app)/page'

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
        <h1 className="text-2xl font-semibold text-slate-900">Azi</h1>
        {streak > 0 && (
          <span className="ml-auto rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
            🔥 {streak} {streak === 1 ? 'zi' : 'zile'} la rând
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
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Top oportunități</h2>
          <p className="mt-1 text-xs text-slate-400">
            Clasament AI, actualizat {relativeDays(portfolioRankings[0].computed_at)}
          </p>
          <ul className="mt-3 space-y-2">
            {portfolioRankings.map((r) => (
              <li key={r.id} className="flex gap-3 border-b border-slate-50 py-2 text-sm last:border-0">
                <span className="w-5 shrink-0 font-semibold text-accent-700">{r.rank}</span>
                <div>
                  <Link href={`/clienti/${r.client_id}`} className="font-medium text-slate-900 hover:text-accent-700">
                    {r.clients?.name ?? 'Client'}
                  </Link>
                  {r.reasoning && <p className="text-xs text-slate-500">{r.reasoning}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Outstanding — follow-up-uri depășite</h2>
        {overdueFollowUps.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nimic scadent azi.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {overdueFollowUps.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 border-b border-slate-50 py-2 last:border-0">
                <Link href={`/clienti/${c.id}`} className="font-medium text-slate-900 hover:text-accent-700">
                  {c.name}
                </Link>
                <span className="text-sm text-slate-500">{c.next_step_description ?? '—'}</span>
                <span className="ml-auto text-sm font-medium text-red-600">
                  {formatDate(c.next_step_date)} · {daysOverdue(c.next_step_date)} zile
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Activități — azi și săptămâna asta</h2>
        {allOpenActivities.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Nicio activitate cu termen în următoarele 7 zile.</p>
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
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Așteaptă clientul</h2>
          {waitingOnClient.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nimic în așteptare.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {waitingOnClient.map((a) => (
                <WaitingRow key={a.id} activity={a} />
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Aștept eu</h2>
          {waitingOnMe.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nimic în așteptare.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {waitingOnMe.map((a) => (
                <WaitingRow key={a.id} activity={a} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Pipeline</h2>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {pipeline.map((col) => (
            <Link
              key={col.status.id}
              href={`/clienti?status=${col.status.id}`}
              className="flex w-40 shrink-0 flex-col rounded-lg border border-slate-100 p-3 transition hover:border-accent-500"
            >
              <span
                className="inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: col.status.color }}
              >
                {col.status.name}
              </span>
              <span className="mt-2 text-xl font-semibold text-slate-900">{col.count}</span>
              <span className="text-xs text-slate-500">{formatMoney(col.totalValue, currency)}</span>
            </Link>
          ))}
        </div>
      </section>

      {teamPerformance.length > 1 && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Performanță echipă</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
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
                  <tr key={m.userId} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-4 text-slate-800">{m.email}</td>
                    <td className="py-2 pr-4">{m.activeClients}</td>
                    <td className="py-2 pr-4">{m.won}</td>
                    <td className="py-2 pr-4">{m.lost}</td>
                    <td className="py-2 pr-4">{m.completedThisWeek}</td>
                    <td className={`py-2 pr-4 ${m.overdue > 0 ? 'font-medium text-red-600' : ''}`}>{m.overdue}</td>
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
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
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
      <h3 className={`text-xs font-medium uppercase tracking-wide ${overdue ? 'text-red-600' : 'text-slate-400'}`}>
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
            <span className="text-slate-800">{a.title}</span>
            {a.clients?.name && (
              <Link href={`/clienti/${a.client_id}`} className="text-xs text-accent-700 hover:underline">
                {a.clients.name}
              </Link>
            )}
            {a.projects?.name && (
              <Link href={`/proiecte/${a.project_id}`} className="text-xs text-accent-700 hover:underline">
                {a.projects.name}
              </Link>
            )}
            <span className={`text-xs ${overdue ? 'font-medium text-red-600' : 'text-slate-400'}`}>
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
      <span className="text-slate-800">{activity.title}</span>
      {activity.clients?.name && (
        <Link href={`/clienti/${activity.client_id}`} className="text-xs text-accent-700 hover:underline">
          {activity.clients.name}
        </Link>
      )}
      {activity.projects?.name && (
        <Link href={`/proiecte/${activity.project_id}`} className="text-xs text-accent-700 hover:underline">
          {activity.projects.name}
        </Link>
      )}
      <span className="ml-auto text-xs text-slate-400">{relativeDays(activity.due_date ?? activity.created_at)}</span>
    </li>
  )
}
