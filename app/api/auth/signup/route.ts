import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

// Signup e invite-only: emailul trebuie să fie în allowed_emails SAU să existe
// o invitație validă pentru el. Verificarea rulează pre-sesiune, deci cu admin
// client (RLS ar bloca citirea).
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Parola trebuie să aibă minim 8 caractere.' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    const admin = createSupabaseAdminClient()

    const { data: allowed } = await admin
      .from('allowed_emails')
      .select('email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    let invited = false
    if (!allowed) {
      const { data: invite } = await admin
        .from('workspace_invites')
        .select('id')
        .eq('email', normalizedEmail)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
      invited = Boolean(invite)
    }

    if (!allowed && !invited) {
      return NextResponse.json(
        { error: 'Acest email nu are acces. Cere o invitație.' },
        { status: 403 }
      )
    }

    const { error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    })

    if (error) {
      // Nu confirmăm existența contului către un apelant neautentificat.
      if (error.message.toLowerCase().includes('already')) {
        return NextResponse.json(
          { error: 'Nu s-a putut crea contul. Încearcă autentificarea.' },
          { status: 400 }
        )
      }
      console.error('[auth/signup]', error)
      return NextResponse.json({ error: 'Înregistrarea a eșuat.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auth/signup]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
