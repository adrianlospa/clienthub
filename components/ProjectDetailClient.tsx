'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Activity, ActivityType, ClientDocument, Comment, Project, ProjectType, WorkspaceMember } from '@/lib/types'
import ProjectFormModal from './ProjectFormModal'
import ActivitiesPanel from './ActivitiesPanel'
import CommentsPanel from './CommentsPanel'
import DocumentsPanel from './DocumentsPanel'

const STATUS_LABELS: Record<Project['status'], string> = {
  active: 'Activ',
  paused: 'Pauzat',
  done: 'Finalizat',
  cancelled: 'Anulat',
}

export default function ProjectDetailClient({
  workspaceId,
  project,
  activities,
  activityTypes,
  comments,
  documents,
  members,
  currentUserId,
  projectTypes,
}: {
  workspaceId: string
  project: Project
  activities: Activity[]
  activityTypes: ActivityType[]
  comments: Comment[]
  documents: ClientDocument[]
  members: WorkspaceMember[]
  currentUserId: string
  projectTypes: ProjectType[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const typeLabel = useMemo(
    () => projectTypes.find((t) => t.key === project.type)?.label ?? project.type,
    [projectTypes, project.type]
  )

  async function changeStatus(status: Project['status']) {
    setSavingStatus(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) router.refresh()
    } finally {
      setSavingStatus(false)
    }
  }

  async function deleteProject() {
    if (!confirm(`Ștergi definitiv proiectul „${project.name}"? Nu poate fi anulat.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/proiecte')
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Link href="/proiecte" className="text-sm text-slate-500 hover:text-slate-700">
        ← Înapoi la proiecte
      </Link>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          <p className="text-slate-500">{typeLabel}</p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="ml-auto rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Editează
        </button>
        <button
          onClick={deleteProject}
          disabled={deleting}
          className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {deleting ? 'Se șterge…' : 'Șterge'}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-6 max-lg:grid-cols-1">
        <div className="col-span-2 space-y-6 max-lg:col-span-1">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Status</h2>
            <select
              value={project.status}
              disabled={savingStatus}
              onChange={(e) => changeStatus(e.target.value as Project['status'])}
              aria-label="Schimbă statusul"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-500"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </section>

          <ActivitiesPanel
            projectId={project.id}
            activities={activities}
            activityTypes={activityTypes}
            members={members}
            currentUserId={currentUserId}
          />

          <CommentsPanel parentType="project" parentId={project.id} comments={comments} />

          <DocumentsPanel
            workspaceId={workspaceId}
            parentType="project"
            parentId={project.id}
            documents={documents}
          />
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Descriere</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {project.description ?? 'Fără descriere.'}
            </p>
          </section>
        </div>
      </div>

      {editing && (
        <ProjectFormModal
          project={project}
          projectTypes={projectTypes}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
