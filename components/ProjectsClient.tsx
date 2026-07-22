'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Project } from '@/lib/types'
import { formatDate } from '@/lib/fmt'
import ProjectFormModal from './ProjectFormModal'

const TYPE_LABELS: Record<Project['type'], string> = {
  website: 'Website',
  video: 'Video',
  course: 'Curs',
  campaign: 'Campanie',
  internal: 'Intern',
}

const STATUS_LABELS: Record<Project['status'], string> = {
  active: 'Activ',
  paused: 'Pauzat',
  done: 'Finalizat',
  cancelled: 'Anulat',
}

export default function ProjectsClient({ projects }: { projects: Project[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink">Proiecte</h1>
        <span className="rounded-full bg-paper px-2.5 py-0.5 text-sm text-ink-muted">
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
        <div className="mt-10 rounded-lg border border-line bg-surface px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-ink">Niciun proiect încă</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
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
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Nume</th>
                <th className="px-4 py-3 font-medium">Tip</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Creat</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-4 py-3">
                    <Link href={`/proiecte/${p.id}`} className="font-medium text-ink hover:text-accent-700">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{TYPE_LABELS[p.type]}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs text-ink-muted">
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <ProjectFormModal
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
