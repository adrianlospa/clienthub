import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { pickWritable } from '@/lib/clients'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const fields = pickWritable(await req.json())
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nimic de actualizat.' }, { status: 400 })
    }

    // RLS filtrează la workspace-urile userului: un id străin dă 0 rânduri.
    const { data, error } = await supabase
      .from('clients')
      .update(fields)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[clients/:id PATCH]', error)
      return NextResponse.json({ error: 'Actualizarea a eșuat.' }, { status: 400 })
    }
    if (!data) return NextResponse.json({ error: 'Clientul nu există.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[clients/:id PATCH]', err)
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

    const { data, error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[clients/:id DELETE]', error)
      return NextResponse.json({ error: 'Ștergerea a eșuat.' }, { status: 400 })
    }
    if (!data) return NextResponse.json({ error: 'Clientul nu există.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[clients/:id DELETE]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
