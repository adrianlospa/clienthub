import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/workspace'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspaceId } = await req.json()
    if (typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }

    // Excepție de la „ai încredere în RLS": mutație de stare persistentă, deci
    // apartenența se re-verifică explicit înainte de a seta cookie-ul.
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Nu ești membru al acestui workspace.' }, { status: 403 })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    return res
  } catch (err) {
    console.error('[workspace/switch]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
