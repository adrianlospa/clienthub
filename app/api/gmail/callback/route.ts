import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getWorkspaceId } from '@/lib/workspace'
import { exchangeCodeForTokens, fetchGoogleEmail } from '@/lib/google-oauth'
import { encrypt } from '@/lib/encryption'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const expectedState = req.cookies.get('gmail_oauth_state')?.value

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/setari?gmail=state_mismatch', origin))
  }

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', origin))

    const workspaceId = await getWorkspaceId(supabase)
    if (!workspaceId) return NextResponse.redirect(new URL('/setari?gmail=error', origin))

    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      // Google nu returnează refresh_token dacă userul a mai autorizat deja
      // aplicația fără `prompt=consent` — nu ar trebui să se întâmple aici
      // (îl forțăm explicit), dar dacă totuși lipsește nu putem persista conexiunea.
      return NextResponse.redirect(new URL('/setari?gmail=no_refresh_token', origin))
    }

    const email = await fetchGoogleEmail(tokens.access_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const { error } = await supabase.from('gmail_connections').upsert(
      {
        workspace_id: workspaceId,
        user_id: user.id,
        email,
        access_token_encrypted: encrypt(tokens.access_token),
        refresh_token_encrypted: encrypt(tokens.refresh_token),
        expires_at: expiresAt,
      },
      { onConflict: 'workspace_id,user_id' }
    )

    if (error) {
      console.error('[gmail/callback]', error)
      return NextResponse.redirect(new URL('/setari?gmail=error', origin))
    }

    const res = NextResponse.redirect(new URL('/setari?gmail=connected', origin))
    res.cookies.delete('gmail_oauth_state')
    return res
  } catch (err) {
    console.error('[gmail/callback]', err)
    return NextResponse.redirect(new URL('/setari?gmail=error', origin))
  }
}
