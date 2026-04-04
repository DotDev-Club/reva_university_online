// POST /api/user/elective-choice
// Student selects (or changes) their elective for a given elective group.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  let body: { schemeId: string; electiveGroup: string; subjectId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const { schemeId, electiveGroup, subjectId } = body
  if (!schemeId || !electiveGroup || !subjectId) {
    return NextResponse.json({ message: 'schemeId, electiveGroup, and subjectId are required.' }, { status: 400 })
  }

  // Verify the subject is a valid option for this scheme + elective group
  const { data: valid, error: validError } = await supabaseAdmin
    .from('scheme_subjects')
    .select('id')
    .eq('scheme_id', schemeId)
    .eq('subject_id', subjectId)
    .eq('elective_group', electiveGroup)
    .eq('is_elective', true)
    .eq('is_active', true)
    .maybeSingle()

  if (validError || !valid) {
    return NextResponse.json({ message: 'Invalid elective choice for this scheme and group.' }, { status: 400 })
  }

  // Upsert — one choice per user per scheme per group
  const { error } = await supabaseAdmin
    .from('user_elective_choices')
    .upsert(
      { user_id: user.id, scheme_id: schemeId, elective_group: electiveGroup, subject_id: subjectId },
      { onConflict: 'user_id,scheme_id,elective_group' }
    )

  if (error) {
    console.error('Elective choice upsert failed:', error)
    return NextResponse.json({ message: 'Failed to save elective choice.' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Elective saved.' })
}
