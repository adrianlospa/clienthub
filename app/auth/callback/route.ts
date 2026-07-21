import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'

// Ținta de redirect după OAuth (Google). Schimbă codul din query pe o sesiune
// și setează cookie-urile, apoi trimite userul mai departe.
//
// Supabase creează automat userul la primul login OAuth — spre deosebire de
// /api/auth/signup, allowlist-ul nu e verificat înainte. Îl verificăm aici,
// după schimbul de cod, și respingem accesul neautorizat înainte de a lăsa
// sesiunea validă mai departe.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user?.email) {
      const email = data.user.email.toLowerCase()
      const admin = createSupabaseAdminClient()

      const { data: allowed } = await admin
        .from('allowed_emails')
        .select('email')
        .eq('email', email)
        .maybeSingle()

      let invited = Boolean(allowed)
      if (!invited) {
        const { data: invite } = await admin
          .from('workspace_invites')
          .select('id')
          .eq('email', email)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()
        invited = Boolean(invite)
      }
      if (!invited) {
        const { data: existingMembership } = await admin
          .from('workspace_members')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle()
        invited = Boolean(existingMembership)
      }

      if (!invited) {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/login?error=not_allowed', origin))
      }

      return NextResponse.redirect(new URL(next, origin))
    }
    console.error('[auth/callback]', error)
  }

  return NextResponse.redirect(new URL('/login?error=oauth', origin))
}
