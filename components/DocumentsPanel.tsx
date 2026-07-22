'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ClientDocument } from '@/lib/types'
import { formatDate } from '@/lib/fmt'

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function DocumentsPanel({
  workspaceId,
  parentType,
  parentId,
  documents,
}: {
  workspaceId: string
  parentType: 'client' | 'project' | 'activity'
  parentId: string
  documents: ClientDocument[]
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const storagePath = `${workspaceId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file)
      if (uploadError) {
        setError(uploadError.message)
        return
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentType,
          parentId,
          filename: file.name,
          storagePath,
          mimeType: file.type || null,
          sizeBytes: file.size,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Salvarea a eșuat.')
        await supabase.storage.from('documents').remove([storagePath])
        return
      }
      router.refresh()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(doc: ClientDocument) {
    const { data, error: signError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60)
    if (signError || !data) {
      setError('Nu s-a putut genera link-ul de descărcare.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleDelete(doc: ClientDocument) {
    if (!confirm(`Ștergi „${doc.filename}"?`)) return
    setBusyId(doc.id)
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Documente</h2>
        <label className="cursor-pointer text-xs font-medium text-accent-700 hover:underline">
          {uploading ? 'Se încarcă…' : '+ Adaugă fișier'}
          <input
            ref={fileInputRef}
            type="file"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
            className="hidden"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {documents.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Niciun document încă.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 border-b border-slate-50 py-2 text-sm last:border-0">
              <button
                onClick={() => handleDownload(d)}
                className="truncate text-left font-medium text-accent-700 hover:underline"
              >
                {d.filename}
              </button>
              <span className="shrink-0 text-xs text-slate-400">{formatSize(d.size_bytes)}</span>
              <span className="shrink-0 text-xs text-slate-400">{formatDate(d.uploaded_at)}</span>
              <button
                onClick={() => handleDelete(d)}
                disabled={busyId === d.id}
                className="ml-auto shrink-0 text-xs text-red-600 hover:underline"
              >
                Șterge
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
