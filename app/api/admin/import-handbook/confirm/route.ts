// POST /api/admin/import-handbook/confirm
// Saves admin-reviewed handbook extraction results to the database.
// Upserts subjects by subject_code (shared across branches), then creates
// scheme and scheme_subjects rows.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

interface SubjectInput {
  subject_code: string
  name: string
  semester: number
  course_type: 'HC' | 'SC' | 'OE' | 'POE' | 'DC'
  elective_group: string | null
  credits: number
}

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = user.app_metadata?.role ?? user.user_metadata?.role
  return role === 'admin' ? user : null
}

export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  let body: { deptId: string; batchStart: number; batchEnd: number; subjects: SubjectInput[] }
  try { body = await request.json() } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const { deptId, batchStart, batchEnd, subjects } = body
  if (!deptId || !batchStart || !batchEnd || !Array.isArray(subjects) || subjects.length === 0) {
    return NextResponse.json({ message: 'deptId, batchStart, batchEnd, and subjects are required.' }, { status: 400 })
  }

  // Verify dept exists
  const { data: dept } = await supabaseAdmin.from('departments').select('name').eq('id', deptId).single()
  if (!dept) return NextResponse.json({ message: 'Department not found.' }, { status: 404 })

  // 1. Upsert scheme
  const schemeName = `${dept.name} ${batchStart}–${batchEnd} Scheme`
  const { data: scheme, error: schemeError } = await supabaseAdmin
    .from('schemes')
    .upsert(
      { dept_id: deptId, name: schemeName, batch_start: batchStart, batch_end: batchEnd, is_active: true },
      { onConflict: 'dept_id,batch_start' }
    )
    .select('id')
    .single()

  if (schemeError || !scheme) {
    console.error('Scheme upsert failed:', schemeError)
    return NextResponse.json({ message: 'Failed to create scheme.' }, { status: 500 })
  }

  // 2. Upsert subjects by subject_code (shared catalogue)
  let subjectsUpserted = 0
  const subjectIdMap = new Map<string, string>() // subject_code → id

  for (const s of subjects) {
    const { data: sub, error } = await supabaseAdmin
      .from('subjects')
      .upsert(
        { subject_code: s.subject_code, name: s.name, course_type: s.course_type, is_active: true },
        { onConflict: 'subject_code' }
      )
      .select('id')
      .single()

    if (error || !sub) {
      console.warn(`Failed to upsert subject ${s.subject_code}:`, error)
      continue
    }
    subjectIdMap.set(s.subject_code, sub.id)
    subjectsUpserted++
  }

  // 3. Insert scheme_subjects (skip if already exists)
  let mappingsCreated = 0
  for (const s of subjects) {
    const subjectId = subjectIdMap.get(s.subject_code)
    if (!subjectId) continue

    const isElective = s.course_type !== 'HC' && s.course_type !== 'DC'
    const { error } = await supabaseAdmin
      .from('scheme_subjects')
      .upsert(
        {
          scheme_id: scheme.id,
          subject_id: subjectId,
          semester: s.semester,
          course_type: s.course_type,
          is_elective: isElective,
          elective_group: s.elective_group ?? null,
          is_active: true,
        },
        { onConflict: 'scheme_id,subject_id' }
      )

    if (!error) mappingsCreated++
  }

  return NextResponse.json({
    schemeName,
    schemeId: scheme.id,
    subjectsUpserted,
    mappingsCreated,
    message: `Scheme "${schemeName}" created with ${mappingsCreated} subjects.`,
  })
}
