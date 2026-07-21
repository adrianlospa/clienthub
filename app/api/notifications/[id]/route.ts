import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[notifications/:id PATCH]', error)
      return NextResponse.json({ error: 'Actualizarea a eșuat.' }, { status: 400 })
    }
    if (!data) return NextResponse.json({ error: 'Notificarea nu există.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications/:id PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
