// GET /api/content/mock-paper/[id]
// Returns a 5-minute signed URL for a mock paper PDF.
// Access checks run server-side (Rule 4.2).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserAccessFields, canAccessMockPaper } from '@/lib/access-control'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: mockPaperId } = await params

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const [userFields, mockPaperResult] = await Promise.all([
    getUserAccessFields(user.id),
    supabaseAdmin
      .from('mock_papers')
      .select('id, file_url, released, subject:subjects(semester)')
      .eq('id', mockPaperId)
      .single(),
  ])

  if (!userFields) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 })
  }

  const mockPaper = mockPaperResult.data
  if (mockPaperResult.error || !mockPaper) {
    return NextResponse.json({ message: 'Mock paper not found' }, { status: 404 })
  }

  const subject = Array.isArray(mockPaper.subject) ? mockPaper.subject[0] : mockPaper.subject

  const access = await canAccessMockPaper(userFields, {
    released: mockPaper.released,
    subject,
  })

  if (!access.allowed) {
    return NextResponse.json(
      { message: 'Access denied', reason: access.reason },
      { status: 403 }
    )
  }

  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from('mock-papers')
    .createSignedUrl(mockPaper.file_url, 300)

  if (signedError || !signedData) {
    console.error('Failed to generate signed URL:', signedError)
    return NextResponse.json({ message: 'Failed to generate URL' }, { status: 500 })
  }

  return NextResponse.json({
    url: signedData.signedUrl,
    expiresIn: 300,
  })
}
