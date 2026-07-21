import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'

const CHANNELS = ['email', 'whatsapp', 'phone', 'instagram', 'facebook', 'linkedin', 'in_person']

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getWorkspaceId(supabase)
    if (!workspaceId) return NextResponse.json({ error: 'Niciun workspace activ.' }, { status: 400 })

    const { clientId, channel, direction, summary, occurredAt } = await req.json()

    if (typeof clientId !== 'string') {
      return NextResponse.json({ error: 'Client lipsă.' }, { status: 400 })
    }
    if (!CHANNELS.includes(channel)) {
      return NextResponse.json({ error: 'Canal invalid.' }, { status: 400 })
    }
    if (direction !== 'in' && direction !== 'out') {
      return NextResponse.json({ error: 'Direcție invalidă.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('interactions')
      .insert({
        workspace_id: workspaceId,
        client_id: clientId,
        channel,
        direction,
        summary: typeof summary === 'string' ? summary.trim() || null : null,
        occurred_at: typeof occurredAt === 'string' && occurredAt ? occurredAt : new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[interactions POST]', error)
      return NextResponse.json({ error: 'Salvarea a eșuat.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[interactions POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
