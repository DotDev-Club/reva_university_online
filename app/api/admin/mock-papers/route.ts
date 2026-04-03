// POST /api/admin/mock-papers — create a mock paper entry
// release_at is computed from exam_date minus app_config: mock_paper_release_hours
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/app-config'

async function requireAdmin(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const role = user.app_metadata?.role ?? user.user_metadata?.role
  return role === 'admin' ? user : null
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const subjectId = formData.get('subjectId') as string | null
  const examDate = formData.get('examDate') as string | null  // YYYY-MM-DD

  if (!file || !subjectId || !examDate) {
    return NextResponse.json({ message: 'file, subjectId, and examDate are required.' }, { status: 400 })
  }

  // Verify subject exists
  const { data: subject } = await supabaseAdmin
    .from('subjects')
    .select('id, dept_id, semester')
    .eq('id', subjectId)
    .single()

  if (!subject) return NextResponse.json({ message: 'Subject not found.' }, { status: 404 })

  // Compute release_at from config (Rule D1 — always from app_config)
  const releaseHours = await getConfig('mock_paper_release_hours')
  const examDateObj = new Date(`${examDate}T00:00:00+05:30`) // IST midnight
  const releaseAt = new Date(examDateObj.getTime() - releaseHours * 3600000)

  // Upload file to storage
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${subject.dept_id}/${subject.semester}/${subjectId}/mock_${examDate}_${Date.now()}.pdf`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('mock-papers')
    .upload(storagePath, fileBuffer, { contentType: 'application/pdf' })

  if (uploadError) {
    console.error('Mock paper upload failed:', uploadError)
    return NextResponse.json({ message: 'File upload failed.' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('mock_papers')
    .insert({
      subject_id: subjectId,
      exam_date: examDate,
      release_at: releaseAt.toISOString(),
      released: releaseAt <= new Date(), // If release time already passed, mark as released
      file_url: storagePath,
    })
    .select('id, exam_date, release_at, released')
    .single()

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  return NextResponse.json({ mockPaper: data }, { status: 201 })
}
