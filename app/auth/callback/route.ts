// GET /auth/callback
// Handles Supabase email confirmation.
// Supports both PKCE code flow AND token_hash flow (Supabase sends either).
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'email' | 'recovery' | null
  const next       = searchParams.get('next') ?? '/dashboard'

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  let session = null

  // PKCE code flow
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) session = data.session
  }
  // Token hash flow (Supabase email links often use this)
  else if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) session = data.session
  }

  if (!session) {
    console.error('Auth callback: could not establish session (no code or token_hash)')
    return NextResponse.redirect(`${origin}/login?error=verification_failed`)
  }

  const user = session.user
  const meta = user.user_metadata ?? {}

  // Idempotent — create users row only if it doesn't exist
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!existingUser) {
    const bumpMonths = 4.5
    const semesterAutoUpdateAt = new Date(Date.now() + bumpMonths * 30.44 * 86400000)

    // Atomic early user slot claim (Rule A2)
    const { data: claimed } = await supabaseAdmin.rpc('claim_early_user_slot')

    await supabaseAdmin.from('users').insert({
      id: user.id,
      email: user.email!,
      full_name: meta.full_name ?? user.email!.split('@')[0],
      dept_id: meta.dept_id ?? null,
      semester_current: meta.semester_current ?? 1,
      semester_auto_update_at: semesterAutoUpdateAt.toISOString(),
      is_early_user: claimed === true,
      email_verified: true,
    })
  } else {
    await supabaseAdmin
      .from('users')
      .update({ email_verified: true })
      .eq('id', user.id)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
