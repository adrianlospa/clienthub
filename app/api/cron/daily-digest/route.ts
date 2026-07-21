import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { buildDigestData, isDigestEmpty, renderDigestHtml } from '@/lib/digest'
import { sendEmail } from '@/lib/email'

// Vercel Cron apelează acest endpoint zilnic (vezi vercel.json). Idempotent —
// re-rularea în aceeași zi trimite din nou digestul, fără efecte secundare
// nedorite (nu scrie stare, doar citește și trimite email).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()

  const { data: prefs, error } = await admin
    .from('user_preferences')
    .select('workspace_id, user_id, workspaces(name)')
    .eq('digest_enabled', true)

  if (error) {
    console.error('[cron/daily-digest]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0

  for (const pref of prefs ?? []) {
    try {
      const { data: userData } = await admin.auth.admin.getUserById(pref.user_id)
      const email = userData.user?.email
      if (!email) continue

      const digest = await buildDigestData(admin, pref.workspace_id, pref.user_id)
      if (isDigestEmpty(digest)) {
        skipped++
        continue
      }

      const workspaceName = (pref as { workspaces?: { name?: string } }).workspaces?.name ?? 'ClientHub'
      await sendEmail({
        to: email,
        subject: `ClientHub — rezumatul zilei (${workspaceName})`,
        html: renderDigestHtml(workspaceName, digest),
      })
      sent++
    } catch (err) {
      console.error('[cron/daily-digest] user', pref.user_id, err)
    }
  }

  return NextResponse.json({ success: true, sent, skipped })
}
