import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { pickActivityFields } from '@/lib/activities'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const fields = pickActivityFields(await req.json())
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nimic de actualizat.' }, { status: 400 })
    }
    // Marcarea ca „done" completează automat done_date dacă nu a fost trimis.
    if (fields.status === 'done' && !('done_date' in fields)) {
      fields.done_date = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('activities')
      .update(fields)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[activities/:id PATCH]', error)
      return NextResponse.json({ error: 'Actualizarea a eșuat.' }, { status: 400 })
    }
    if (!data) return NextResponse.json({ error: 'Activitatea nu există.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[activities/:id PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase.from('activities').delete().eq('id', id).select('id').maybeSingle()
    if (error) {
      console.error('[activities/:id DELETE]', error)
      return NextResponse.json({ error: 'Ștergerea a eșuat.' }, { status: 400 })
    }
    if (!data) return NextResponse.json({ error: 'Activitatea nu există.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[activities/:id DELETE]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
