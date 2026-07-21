import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { getValidAccessToken, fetchRecentMessagesForAddress } from '@/lib/gmail'

// Sincronizare manuală (nu polling în fundal — spec Phase 2, scop redus
// intenționat). Caută, pentru fiecare client cu adresă de email, mesaje din
// ultimele 30 zile și le adaugă în interactions. Idempotent: external_ref
// (id-ul mesajului Gmail) are unique constraint pe (workspace_id, external_ref).
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getWorkspaceId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Niciun workspace activ.' }, { status: 400 })

  const { data: connection } = await supabase
    .from('gmail_connections')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ error: 'Niciun cont Gmail conectat.' }, { status: 400 })
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, email')
    .eq('workspace_id', workspaceId)
    .not('email', 'is', null)

  let imported = 0
  let scanned = 0

  try {
    const accessToken = await getValidAccessToken(supabase, connection)

    for (const client of clients ?? []) {
      const messages = await fetchRecentMessagesForAddress(accessToken, client.email)
      scanned += messages.length

      for (const msg of messages) {
        const direction = msg.from.toLowerCase().includes(connection.email.toLowerCase()) ? 'out' : 'in'
        const { error } = await supabase.from('interactions').insert({
          workspace_id: workspaceId,
          client_id: client.id,
          channel: 'email',
          direction,
          occurred_at: new Date(Number(msg.internalDate)).toISOString(),
          summary: msg.subject || msg.snippet,
          raw_content: msg.snippet,
          external_ref: msg.id,
        })
        // Conflict pe (workspace_id, external_ref) = deja importat — ignorăm eroarea.
        if (!error) imported++
      }
    }
  } catch (err) {
    console.error('[gmail/sync]', err)
    return NextResponse.json({ error: 'Sincronizarea a eșuat. Poate fi nevoie să reconectezi contul.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, scanned, imported })
}
