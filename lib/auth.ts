import { cache } from 'react'
import { createSupabaseServerClient } from './supabase-server'

// auth.getUser() e un apel de rețea către Supabase (verificare reală de
// token, nu doar citire de cookie) — fără dedup, layout.tsx + page.tsx
// apelau fiecare propria copie pe aceeași navigare, dublând latența.
// React cache() combină toate apelurile din același request într-unul singur.
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
