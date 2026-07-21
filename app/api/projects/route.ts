import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { pickProjectFields } from '@/lib/projects'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getWorkspaceId(supabase)
    if (!workspaceId) return NextResponse.json({ error: 'Niciun workspace activ.' }, { status: 400 })

    const fields = pickProjectFields(await req.json())
    if (typeof fields.name !== 'string' || !fields.name.trim()) {
      return NextResponse.json({ error: 'Numele este obligatoriu.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...fields, workspace_id: workspaceId })
      .select('id')
      .single()

    if (error) {
      console.error('[projects POST]', error)
      return NextResponse.json({ error: 'Salvarea a eșuat.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[projects POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
