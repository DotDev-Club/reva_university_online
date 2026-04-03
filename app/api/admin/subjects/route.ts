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

  let query = supabaseAdmin.from('subjects').select('id, name, subject_code, semester, is_active').order('subject_code')
  if (deptId) query = query.eq('dept_id', deptId)
  if (semester) query = query.eq('semester', Number(semester))

  const { data, error } = await query
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  return NextResponse.json({ subjects: data })
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
