import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RLS filtrează la workspace-ul userului: un id străin dă 0 rânduri.
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('[documents/:id DELETE]', fetchError)
      return NextResponse.json({ error: 'Ștergerea a eșuat.' }, { status: 400 })
    }
    if (!doc) return NextResponse.json({ error: 'Documentul nu există.' }, { status: 404 })

    await supabase.storage.from('documents').remove([doc.storage_path])

    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) {
      console.error('[documents/:id DELETE]', error)
      return NextResponse.json({ error: 'Ștergerea a eșuat.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[documents/:id DELETE]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
