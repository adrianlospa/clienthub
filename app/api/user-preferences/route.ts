import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getWorkspaceId(supabase)
    if (!workspaceId) return NextResponse.json({ error: 'Niciun workspace activ.' }, { status: 400 })

    const { digestEnabled } = await req.json()
    if (typeof digestEnabled !== 'boolean') {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        { workspace_id: workspaceId, user_id: user.id, digest_enabled: digestEnabled },
        { onConflict: 'workspace_id,user_id' }
      )

    if (error) {
      console.error('[user-preferences PATCH]', error)
      return NextResponse.json({ error: 'Salvarea a eșuat.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[user-preferences PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
