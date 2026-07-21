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
    if (!workspaceId) return NextResponse.json({ duplicates: [] })

    const { name, email, phone, excludeId } = await req.json()

    const { data, error } = await supabase.rpc('find_duplicate_clients', {
      p_workspace_id: workspaceId,
      p_name: typeof name === 'string' ? name : null,
      p_email: typeof email === 'string' && email.trim() ? email.trim() : null,
      p_phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
      p_exclude_id: typeof excludeId === 'string' ? excludeId : null,
    })

    if (error) {
      console.error('[clients/check-duplicate]', error)
      return NextResponse.json({ duplicates: [] })
    }

    return NextResponse.json({ duplicates: data ?? [] })
  } catch (err) {
    console.error('[clients/check-duplicate]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
