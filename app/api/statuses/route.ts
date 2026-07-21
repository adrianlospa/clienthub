import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getWorkspaceId(supabase)
    if (!workspaceId) return NextResponse.json({ error: 'Niciun workspace activ.' }, { status: 400 })

    const { name, color, phase, is_won, is_lost, sort_order } = await req.json()
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Numele este obligatoriu.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('statuses')
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        color: typeof color === 'string' ? color : '#64748b',
        phase: phase === 'post_sale' ? 'post_sale' : 'pre_sale',
        is_won: Boolean(is_won),
        is_lost: Boolean(is_lost),
        sort_order: typeof sort_order === 'number' ? sort_order : 0,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Există deja un status cu acest nume.' }, { status: 400 })
      }
      console.error('[statuses POST]', error)
      return NextResponse.json({ error: 'Salvarea a eșuat.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[statuses POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
