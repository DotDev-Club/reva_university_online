// POST /api/user/update-semester
// Updates semester_current with Rule C3 bounds enforced server-side.
// ±1 from current, or any lower value. Never affects subscription_semester.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  let body: { semesterCurrent: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const { semesterCurrent: newSemester } = body

  if (!newSemester || newSemester < 1 || newSemester > 8) {
    return NextResponse.json({ message: 'Semester must be between 1 and 8.' }, { status: 400 })
  }

  // Fetch current semester to enforce Rule C3 bounds
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('semester_current')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ message: 'User not found.' }, { status: 404 })
  }

  const current = profile.semester_current ?? 1

  // Rule C3: only allow ≤ current value or current+1
  const isAllowed = newSemester <= current || newSemester === current + 1

  if (!isAllowed) {
    return NextResponse.json(
      {
        message: `You can only move to Semester ${current - 1 > 0 ? `1–${current}` : '1'} or Semester ${current + 1 <= 8 ? current + 1 : current}. Contact support for other changes.`,
      },
      { status: 400 }
    )
  }

  // NOTE: subscription_semester is NOT updated here — ever. The DB trigger enforces
  // immutability. This route only touches semester_current.
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ semester_current: newSemester })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ message: 'Update failed.' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Semester updated.', semesterCurrent: newSemester })
}
