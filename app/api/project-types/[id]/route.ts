import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const WRITABLE = ['key', 'label', 'color', 'sort_order'] as const

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const fields: Record<string, unknown> = {}
    for (const key of WRITABLE) if (key in body) fields[key] = body[key]
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nimic de actualizat.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_types')
      .update(fields)
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Există deja un tip de proiect cu această cheie.' }, { status: 400 })
      }
      console.error('[project-types/:id PATCH]', error)
      return NextResponse.json({ error: 'Actualizarea a eșuat.' }, { status: 400 })
    }
    if (!data) return NextResponse.json({ error: 'Tipul de proiect nu există.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[project-types/:id PATCH]', err)
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

    // Proiectele existente cu acest tip rămân cu valoarea textuală — avertizăm
    // în UI câte proiecte sunt afectate înainte de a ajunge aici.
    const { data, error } = await supabase
      .from('project_types')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[project-types/:id DELETE]', error)
      return NextResponse.json({ error: 'Ștergerea a eșuat.' }, { status: 400 })
    }
    if (!data) return NextResponse.json({ error: 'Tipul de proiect nu există.' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[project-types/:id DELETE]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
