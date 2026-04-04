// GET  /api/admin/subjects?deptId=&semester=  — list subjects (admin, includes inactive)
// POST /api/admin/subjects                    — create a new subject
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function requireAdmin(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const role = user.app_metadata?.role ?? user.user_metadata?.role
  return role === 'admin' ? user : null
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const deptId = searchParams.get('deptId')
  const semester = searchParams.get('semester')

  // Legacy subjects: direct dept_id match
  let legacyQuery = supabaseAdmin
    .from('subjects')
    .select('id, name, subject_code, semester, is_active')
    .order('subject_code')
  if (deptId) legacyQuery = legacyQuery.eq('dept_id', deptId)
  if (semester) legacyQuery = legacyQuery.eq('semester', Number(semester))

  // Scheme-linked subjects: subjects via scheme_subjects for this dept's schemes
  let schemeSubjects: { id: string; name: string; subject_code: string; semester: number | null; is_active: boolean }[] = []
  if (deptId) {
    const semNum = semester ? Number(semester) : null
    let ssQuery = supabaseAdmin
      .from('scheme_subjects')
      .select('semester, subject:subjects(id, name, subject_code, is_active), scheme:schemes!inner(dept_id)')
      .eq('scheme.dept_id', deptId)
      .eq('is_active', true)
    if (semNum) ssQuery = ssQuery.eq('semester', semNum)
    const { data: ssRows } = await ssQuery
    for (const row of ssRows ?? []) {
      const sub = Array.isArray(row.subject) ? row.subject[0] : row.subject as any
      if (sub?.id) {
        schemeSubjects.push({ id: sub.id, name: sub.name, subject_code: sub.subject_code, semester: row.semester, is_active: sub.is_active })
      }
    }
  }

  const { data: legacy } = await legacyQuery

  // Merge, deduplicate by id
  const seen = new Set<string>()
  const combined = []
  for (const s of [...(legacy ?? []), ...schemeSubjects]) {
    if (!seen.has(s.id)) {
      seen.add(s.id)
      combined.push(s)
    }
  }
  combined.sort((a, b) => a.subject_code.localeCompare(b.subject_code))

  return NextResponse.json({ subjects: combined })
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  let body: { deptId: string; semester: number; subjectCode: string; name: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid body' }, { status: 400 })
  }

  const { deptId, semester, subjectCode, name } = body
  if (!deptId || !semester || !subjectCode || !name) {
    return NextResponse.json({ message: 'All fields required.' }, { status: 400 })
  }
  if (semester < 1 || semester > 8) {
    return NextResponse.json({ message: 'Semester must be 1–8.' }, { status: 400 })
  }

  // Rule F3: subject_code must be unique within dept+semester
  const { data: existing } = await supabaseAdmin
    .from('subjects')
    .select('id')
    .eq('dept_id', deptId)
    .eq('semester', semester)
    .eq('subject_code', subjectCode.trim().toUpperCase())
    .single()

  if (existing) {
    return NextResponse.json(
      { message: `Subject code ${subjectCode.toUpperCase()} already exists in this dept+semester.` },
      { status: 409 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .insert({
      dept_id: deptId,
      semester,
      subject_code: subjectCode.trim().toUpperCase(),
      name: name.trim(),
      is_active: true,
    })
    .select('id, name, subject_code')
    .single()

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  return NextResponse.json({ subject: data }, { status: 201 })
}
