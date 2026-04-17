// Mock paper viewer — access checks run server-side (Rule 4.2).
// Signed URL requested client-side via MockPaperViewer component.
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserAccessFields, canAccessMockPaper } from '@/lib/access-control'
import MockPaperViewer from '@/components/MockPaperViewer'

export default async function MockPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [userFields, paperResult] = await Promise.all([
    getUserAccessFields(user.id),
    supabaseAdmin
      .from('mock_papers')
      .select('id, exam_date, released, subject:subjects(id, name, subject_code, semester, dept:departments(name))')
      .eq('id', id)
      .single(),
  ])

  if (!userFields) redirect('/login')

  const paper = paperResult.data
  if (paperResult.error || !paper) notFound()

  const subject = Array.isArray(paper.subject) ? paper.subject[0] : paper.subject
  const dept = subject ? (Array.isArray(subject.dept) ? subject.dept[0] : subject.dept) : null

  const access = await canAccessMockPaper(userFields, {
    released: paper.released,
    subject: { semester: subject.semester },
  })

  const examDate = new Date(paper.exam_date)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-white"
          style={{ borderColor: 'var(--reva-border)', color: 'var(--reva-navy)' }}
        >
          ← Back
        </Link>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--reva-muted)' }}>
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          <span>/</span>
          <span style={{ color: 'var(--reva-navy)', fontWeight: 500 }}>Mock Paper</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--reva-border)', borderTopWidth: 3, borderTopColor: 'var(--reva-teal)' }}>
        <p className="text-xs font-mono mb-1" style={{ color: 'var(--reva-muted)' }}>
          {(subject as any)?.subject_code} · Semester {(subject as any)?.semester} · {(dept as any)?.name}
        </p>
        <h1 className="text-xl font-bold" style={{ color: 'var(--reva-navy)' }}>{(subject as any)?.name}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--reva-muted)' }}>
          Mock Paper · Exam:{' '}
          {examDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Access denied states */}
      {!access.allowed && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          {access.reason === 'NOT_YET_RELEASED' && (
            <>
              <p className="text-lg font-semibold text-gray-700 mb-1">Paper not yet released</p>
              <p className="text-gray-500 text-sm">
                This mock paper will be available 24 hours before the exam.
              </p>
            </>
          )}
          {access.reason === 'NOT_SUBSCRIBED' && (
            <>
              <p className="text-lg font-semibold text-gray-700 mb-1">Paid access required</p>
              <p className="text-gray-500 text-sm">Mock papers are only available to subscribers.</p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block rounded-lg bg-[#1E3A5F] px-5 py-2 text-sm font-medium text-white hover:bg-[#163049] transition-colors"
              >
                Upgrade Access
              </Link>
            </>
          )}
          {access.reason === 'WRONG_SEMESTER' && (
            <>
              <p className="text-lg font-semibold text-gray-700 mb-1">Wrong semester</p>
              <p className="text-gray-500 text-sm">
                Your subscription covers Semester {userFields.subscription_semester}. This paper is for Semester {(subject as any)?.semester}.
              </p>
            </>
          )}
        </div>
      )}

      {/* PDF viewer — only rendered if access is allowed */}
      {access.allowed && <MockPaperViewer mockPaperId={id} />}
    </div>
  )
}
