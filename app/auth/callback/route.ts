// GET /auth/callback
// Handles Supabase email confirmation redirect.
// After verifying the code:
//   1. Creates the users profile row
//   2. Attempts to claim an early user slot (atomic, Rule A2)
//   3. Sets semester_auto_update_at
// Unverified accounts do NOT consume early user slots (Rule G1).
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

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

  const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !session) {
    console.error('Code exchange failed:', exchangeError)
    return NextResponse.redirect(`${origin}/login?error=verification_failed`)
  }

  const user = session.user
  const meta = user.user_metadata ?? {}

  // Check if users row already exists (idempotent — callback can be called multiple times)
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!existingUser) {
    // Calculate semester_auto_update_at (Rule C2: bump after 4.5 months)
    const bumpMonths = 4.5
    const semesterAutoUpdateAt = new Date(Date.now() + bumpMonths * 30.44 * 86400000)

    // Attempt atomic early user slot claim (Rule A2 — never read-then-write)
    const { data: claimed } = await supabaseAdmin.rpc('claim_early_user_slot')
    const isEarlyUser = claimed === true

    // Create users profile row
    const { error: insertError } = await supabaseAdmin.from('users').insert({
      id: user.id,
      email: user.email!,
      full_name: meta.full_name ?? '',
      dept_id: meta.dept_id ?? null,
      semester_current: meta.semester_current ?? 1,
      semester_auto_update_at: semesterAutoUpdateAt.toISOString(),
      is_early_user: isEarlyUser,
      email_verified: true,
    })

    if (insertError) {
      console.error('Failed to create user profile:', insertError)
      // Don't block the user — redirect to dashboard and let them try again
    }
  } else {
    // User row exists — just mark email as verified
    await supabaseAdmin
      .from('users')
      .update({ email_verified: true })
      .eq('id', user.id)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
