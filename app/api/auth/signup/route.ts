// POST /api/auth/signup
// Validates signup data and calls Supabase auth.signUp().
// User profile row is created in /auth/callback after email verification.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  let body: { email: string; password: string; fullName: string; deptId: string; semesterCurrent: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const { email, password, fullName, deptId, semesterCurrent } = body

  // Validate inputs
  if (!email || !password || !fullName || !deptId || !semesterCurrent) {
    return NextResponse.json({ message: 'All fields are required.' }, { status: 400 })
  }
  if (fullName.trim().length < 2) {
    return NextResponse.json({ message: 'Please enter your full name.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ message: 'Password must be at least 8 characters.' }, { status: 400 })
  }
  if (semesterCurrent < 1 || semesterCurrent > 8) {
    return NextResponse.json({ message: 'Semester must be between 1 and 8.' }, { status: 400 })
  }

  // Verify department exists and is active
  const { data: dept, error: deptError } = await supabaseAdmin
    .from('departments')
    .select('id, name')
    .eq('id', deptId)
    .eq('is_active', true)
    .single()

  if (deptError || !dept) {
    return NextResponse.json({ message: 'Invalid department selected.' }, { status: 400 })
  }

  // Create Supabase auth user — store profile data in user_metadata
  // Profile row is created in /auth/callback after email verification (Rule G1)
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error: signUpError } = await supabaseAuth.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
      data: {
        full_name: fullName.trim(),
        dept_id: deptId,
        semester_current: semesterCurrent,
      },
    },
  })

  if (signUpError) {
    // Don't expose internal error details — return a clean message
    if (signUpError.message.toLowerCase().includes('already registered')) {
      return NextResponse.json({ message: 'An account with this email already exists.' }, { status: 409 })
    }
    return NextResponse.json({ message: signUpError.message }, { status: 400 })
  }

  return NextResponse.json({ message: 'Check your email to verify your account.' }, { status: 200 })
}
