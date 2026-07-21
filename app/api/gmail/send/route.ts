import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { getValidAccessToken, sendGmailMessage } from '@/lib/gmail'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getWorkspaceId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Niciun workspace activ.' }, { status: 400 })

  const { to, subject, body, clientId } = await req.json()
  if (typeof to !== 'string' || typeof subject !== 'string' || typeof body !== 'string') {
    return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
  }

  const { data: connection } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ error: 'Niciun cont Gmail conectat.' }, { status: 400 })
  }

  try {
    const accessToken = await getValidAccessToken(supabase, connection)
    await sendGmailMessage(accessToken, connection.email, to, subject, body)

    if (typeof clientId === 'string') {
      await supabase.from('interactions').insert({
        workspace_id: workspaceId,
        client_id: clientId,
        channel: 'email',
        direction: 'out',
        summary: subject,
        raw_content: body,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[gmail/send]', err)
    return NextResponse.json({ error: 'Trimiterea a eșuat.' }, { status: 500 })
  }
}
