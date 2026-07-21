import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { pickActivityFields } from '@/lib/activities'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getWorkspaceId(supabase)
    if (!workspaceId) return NextResponse.json({ error: 'Niciun workspace activ.' }, { status: 400 })

    const fields = pickActivityFields(await req.json())
    if (typeof fields.title !== 'string' || !fields.title.trim()) {
      return NextResponse.json({ error: 'Titlul este obligatoriu.' }, { status: 400 })
    }
    if (typeof fields.type !== 'string' || !fields.type) {
      return NextResponse.json({ error: 'Tipul este obligatoriu.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('activities')
      .insert({
        ...fields,
        workspace_id: workspaceId,
        assigned_to: typeof fields.assigned_to === 'string' ? fields.assigned_to : user.id,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[activities POST]', error)
      return NextResponse.json({ error: 'Salvarea a eșuat.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[activities POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
