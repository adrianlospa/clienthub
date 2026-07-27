'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Project, ProjectType } from '@/lib/types'
import { formatDate } from '@/lib/fmt'
import ProjectFormModal from './ProjectFormModal'

const STATUS_LABELS: Record<Project['status'], string> = {
  active: 'Activ',
  paused: 'Pauzat',
  done: 'Finalizat',
  cancelled: 'Anulat',
}

export default function ProjectsClient({
  projects,
  projectTypes,
}: {
  projects: Project[]
  projectTypes: ProjectType[]
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const typeByKey = useMemo(() => new Map(projectTypes.map((t) => [t.key, t])), [projectTypes])

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Proiecte</h1>
        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-sm text-slate-600">
          {projects.length}
        </span>
        <button
          onClick={() => setCreating(true)}
          className="ml-auto rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700"
        >
          + Proiect nou
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Niciun proiect încă</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Website-uri, video-uri, cursuri, campanii — orice muncă fără client atașat.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-6 rounded-lg bg-accent-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-700"
          >
            + Adaugă primul proiect
          </button>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nume</th>
                <th className="px-4 py-3 font-medium">Tip</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Creat</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/proiecte/${p.id}`} className="font-medium text-slate-900 hover:text-accent-700">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{typeByKey.get(p.type)?.label ?? p.type}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <ProjectFormModal
          projectTypes={projectTypes}
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
