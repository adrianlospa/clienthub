'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NotificationSettings({ digestEnabled }: { digestEnabled: boolean }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(digestEnabled)
  const [saving, setSaving] = useState(false)

  async function toggle(value: boolean) {
    setEnabled(value)
    setSaving(true)
    try {
      await fetch('/api/user-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digestEnabled: value }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Notificări</h2>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => toggle(e.target.checked)}
        />
        Digest zilnic pe email (dimineața, cu follow-up-uri și activități depășite)
      </label>
    </section>
  )
}
