import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildGoogleAuthUrl } from '@/lib/google-oauth'

// Pornește fluxul OAuth Gmail — separat complet de login-ul Supabase, ca să
// obținem un refresh_token pe termen lung cu scope Gmail.
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))

  const state = randomBytes(16).toString('hex')
  const res = NextResponse.redirect(buildGoogleAuthUrl(state))
  res.cookies.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}


export const dynamic = 'force-dynamic'
