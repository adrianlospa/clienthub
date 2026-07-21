import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ⚠️ Next.js 16: fișierul de middleware se numește proxy.ts și exportă `proxy`.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() citește local din cookie, fără rută de rețea către Supabase —
  // middleware-ul rulează pe fiecare navigare, deci un apel de rețea aici s-ar
  // repeta la fiecare click. Verificarea reală (auth.getUser()) rămâne
  // obligatorie în fiecare pagină/route handler; asta e doar poarta de UX.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Invitație în așteptare — doar pe navigări HTML, nu pe API/assets.
  if (user && !isAuthRoute) {
    const pendingInvite = request.cookies.get('pending_invite')?.value
    const isNavigation = request.headers.get('accept')?.includes('text/html') ?? false
    if (pendingInvite && isNavigation) {
      return NextResponse.redirect(
        new URL(`/auth/accept-invite?token=${pendingInvite}`, request.url)
      )
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron).*)'],
}
