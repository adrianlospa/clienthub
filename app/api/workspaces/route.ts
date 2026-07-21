import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { slugify } from '@/lib/slug'
import { seedWorkspaceDefaults } from '@/lib/workspace-defaults'

// Crearea unui workspace nu are policy de INSERT (RLS deny-all intenționat —
// e o mutație de graniță de tenant, nu o scriere obișnuită). Trece prin admin
// client, dar doar după autentificare normală; creatorul devine admin.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await req.json()
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Numele este obligatoriu.' }, { status: 400 })
    }

    const admin = createSupabaseAdminClient()
    const base = slugify(name) || 'workspace'
    let slug = base
    for (let attempt = 0; attempt < 20; attempt++) {
      const { data: existing } = await admin.from('workspaces').select('id').eq('slug', slug).maybeSingle()
      if (!existing) break
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
    }

    const { data: workspace, error } = await admin
      .from('workspaces')
      .insert({ name: name.trim(), slug })
      .select('id, name, slug')
      .single()

    if (error) {
      console.error('[workspaces POST]', error)
      return NextResponse.json({ error: 'Crearea workspace-ului a eșuat.' }, { status: 400 })
    }

    const { error: memberError } = await admin
      .from('workspace_members')
      .insert({ workspace_id: workspace.id, user_id: user.id, role: 'admin' })
    if (memberError) {
      console.error('[workspaces POST]', memberError)
      await admin.from('workspaces').delete().eq('id', workspace.id)
      return NextResponse.json({ error: 'Crearea workspace-ului a eșuat.' }, { status: 400 })
    }

    await seedWorkspaceDefaults(admin, workspace.id)

    return NextResponse.json({ success: true, workspace })
  } catch (err) {
    console.error('[workspaces POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
