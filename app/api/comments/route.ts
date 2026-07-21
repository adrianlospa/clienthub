import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'

const PARENT_TYPES = ['client', 'project', 'activity']

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getWorkspaceId(supabase)
    if (!workspaceId) return NextResponse.json({ error: 'Niciun workspace activ.' }, { status: 400 })

    const { parentType, parentId, text } = await req.json()

    if (!PARENT_TYPES.includes(parentType) || typeof parentId !== 'string') {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Notița nu poate fi goală.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        workspace_id: workspaceId,
        parent_type: parentType,
        parent_id: parentId,
        text: text.trim(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[comments POST]', error)
      return NextResponse.json({ error: 'Salvarea a eșuat.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[comments POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
