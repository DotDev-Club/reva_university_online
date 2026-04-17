import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserAccessFields } from '@/lib/access-control'

export default async function PapersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [userFields, { data: profile }] = await Promise.all([
    getUserAccessFields(user.id),
    supabaseAdmin.from('users').select('semester_current, scheme_id').eq('id', user.id).single(),
  ])

  if (!userFields) redirect('/login')

  const isSubscribed =
    userFields.is_early_user ||
    (userFields.subscription_expires_at !== null && new Date(userFields.subscription_expires_at) > new Date())

  // Fetch all mock papers, ordered by exam date
  const { data: mockPapers } = await supabaseAdmin
    .from('mock_papers')
    .select('id, exam_date, release_at, released, subject:subjects(id, name, subject_code, semester, dept:departments(name))')
    .order('exam_date')

  const now = new Date()
  const upcoming = (mockPapers ?? []).filter(p => new Date(p.exam_date) >= now)
  const past = (mockPapers ?? []).filter(p => new Date(p.exam_date) < now)

  function PaperRow({ paper }: { paper: typeof mockPapers extends (infer T)[] | null ? T : never }) {
    const subject = Array.isArray(paper.subject) ? paper.subject[0] : paper.subject as any
    const dept = subject ? (Array.isArray(subject.dept) ? subject.dept[0] : subject.dept) : null
    const examDate = new Date(paper.exam_date)
    const daysToExam = Math.ceil((examDate.getTime() - now.getTime()) / 86400000)
    const canAccess = isSubscribed && paper.released

    return (
      <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: paper.released ? 'var(--reva-teal)' : 'var(--reva-navy)' }}
          >
            {(subject?.subject_code ?? '??').slice(-3)}
          </div>
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--reva-navy)' }}>{subject?.name ?? '—'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--reva-muted)' }}>
              {subject?.subject_code} · {(dept as any)?.name} · Sem {subject?.semester}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--reva-muted)' }}>
              Exam: {examDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {daysToExam > 0 && ` · ${daysToExam}d away`}
              {daysToExam === 0 && ' · Today'}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {canAccess ? (
            <Link href={`/mock-paper/${paper.id}`} className="btn-reva text-xs px-4 py-1.5">
              View Paper
            </Link>
          ) : paper.released && !isSubscribed ? (
            <span className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: 'var(--reva-orange-light)', color: 'var(--reva-orange)' }}>
              🔒 Subscribe
            </span>
          ) : (
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--reva-navy-light)', color: 'var(--reva-muted)' }}>
              {paper.released ? 'Released' : daysToExam > 1 ? `In ${daysToExam}d` : daysToExam === 1 ? 'Tomorrow' : 'Soon'}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--reva-navy)' }}>Mock Papers</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--reva-muted)' }}>
          Papers are released 24 hours before the exam. Subscription required to view.
        </p>
      </div>

      {/* Subscription notice */}
      {!isSubscribed && (
        <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--reva-orange-light)', borderColor: '#FDDBB4', borderLeftWidth: 4, borderLeftColor: 'var(--reva-orange)' }}>
          <span className="text-xl">🔒</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--reva-navy)' }}>Subscribe to access mock papers</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--reva-orange-dark)' }}>
              Subscription covers your current semester only · 6 months · non-transferable
            </p>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--reva-muted)' }}>
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-2xl border p-6 text-center" style={{ borderColor: 'var(--reva-border)' }}>
            <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>No upcoming exams scheduled.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden divide-y" style={{ borderColor: 'var(--reva-border)' }}>
            {upcoming.map(p => <PaperRow key={p.id} paper={p} />)}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--reva-muted)' }}>
            Past Papers ({past.length})
          </h2>
          <div className="bg-white rounded-2xl border overflow-hidden divide-y" style={{ borderColor: 'var(--reva-border)', opacity: 0.8 }}>
            {past.map(p => <PaperRow key={p.id} paper={p} />)}
          </div>
        </section>
      )}

      {(!mockPapers || mockPapers.length === 0) && (
        <div className="bg-white rounded-2xl border p-10 text-center" style={{ borderColor: 'var(--reva-border)' }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4" style={{ background: 'var(--reva-orange-light)' }}>📝</div>
          <p className="font-medium" style={{ color: 'var(--reva-navy)' }}>No mock papers yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--reva-muted)' }}>Papers will appear here when added by your admin.</p>
        </div>
      )}
    </div>
  )
}
