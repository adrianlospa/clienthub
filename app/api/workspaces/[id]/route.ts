import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Redenumire: RLS (workspaces_update) permite doar adminilor workspace-ului,
// deci clientul normal e suficient — niciun bypass necesar.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await req.json()
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Numele este obligatoriu.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('workspaces')
      .update({ name: name.trim() })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[workspaces/:id PATCH]', error)
      return NextResponse.json({ error: 'Actualizarea a eșuat.' }, { status: 400 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Nu ești admin al acestui workspace.' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[workspaces/:id PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
