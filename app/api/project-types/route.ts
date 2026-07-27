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

    const { key, label, color, sort_order } = await req.json()
    if (typeof key !== 'string' || !key.trim() || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json({ error: 'Cheia și eticheta sunt obligatorii.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_types')
      .insert({
        workspace_id: workspaceId,
        key: key.trim(),
        label: label.trim(),
        color: typeof color === 'string' ? color : '#64748b',
        sort_order: typeof sort_order === 'number' ? sort_order : 0,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Există deja un tip de proiect cu această cheie.' }, { status: 400 })
      }
      console.error('[project-types POST]', error)
      return NextResponse.json({ error: 'Salvarea a eșuat.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[project-types POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
