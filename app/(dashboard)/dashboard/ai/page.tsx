import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserAccessFields } from '@/lib/access-control'

export default async function AIPage() {
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

  // Fetch subjects for the user's current semester
  let subjects: { id: string; name: string; subject_code: string; semester: number }[] = []

  if (profile?.scheme_id) {
    const { data: rows } = await supabaseAdmin
      .from('scheme_subjects')
      .select('subject:subjects(id, name, subject_code, semester)')
      .eq('scheme_id', profile.scheme_id)
      .eq('semester', profile.semester_current ?? 1)
      .eq('is_elective', false)
      .eq('is_active', true)
    subjects = (rows ?? []).map(r => {
      const s = Array.isArray(r.subject) ? r.subject[0] : r.subject as any
      return s
    }).filter(Boolean)

    // Also include chosen electives
    const { data: chosen } = await supabaseAdmin
      .from('user_elective_choices')
      .select('scheme_subjects!inner(semester, subject:subjects(id, name, subject_code, semester))')
      .eq('user_id', user.id)
      .eq('scheme_id', profile.scheme_id)
    const electiveSubjects = (chosen ?? []).map(r => {
      const ss = Array.isArray(r.scheme_subjects) ? r.scheme_subjects[0] : r.scheme_subjects as any
      if (!ss || ss.semester !== profile.semester_current) return null
      const sub = Array.isArray(ss.subject) ? ss.subject[0] : ss.subject
      return sub
    }).filter(Boolean) as typeof subjects
    subjects = [...subjects, ...electiveSubjects]
    subjects.sort((a, b) => a.subject_code.localeCompare(b.subject_code))
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--reva-navy)' }}>AI Q&amp;A</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--reva-muted)' }}>
          Ask questions about any of your Semester {profile?.semester_current} subjects. Answers are based on your syllabus only.
        </p>
      </div>

      {/* Not subscribed */}
      {!isSubscribed && (
        <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--reva-border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4" style={{ background: '#F3E5F5' }}>🤖</div>
          <p className="font-semibold text-lg" style={{ color: 'var(--reva-navy)' }}>AI Q&amp;A is a paid feature</p>
          <p className="text-sm mt-2" style={{ color: 'var(--reva-muted)' }}>
            Subscribe to ask unlimited questions about your subjects.<br />
            Answers come directly from your uploaded study materials.
          </p>
          <Link href="/dashboard" className="btn-reva inline-block mt-5 px-6 py-2.5">
            View Plans
          </Link>
        </div>
      )}

      {/* Subject grid — pick a subject to open its Q&A */}
      {isSubscribed && (
        <>
          <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ background: 'var(--reva-teal-light)', borderColor: 'var(--reva-teal)' }}>
            <span className="text-xl">💡</span>
            <p className="text-sm" style={{ color: 'var(--reva-teal)' }}>
              <strong>How it works:</strong> Pick a subject below, then ask any question. The AI answers only from that subject's notes — no hallucinations.
            </p>
          </div>

          {subjects.length === 0 ? (
            <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--reva-border)' }}>
              <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>No subjects found for your current semester.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {subjects.map((subject, i) => {
                const colors = [
                  { bg: 'var(--reva-teal)', light: 'var(--reva-teal-light)' },
                  { bg: 'var(--reva-orange)', light: 'var(--reva-orange-light)' },
                  { bg: '#8E24AA', light: '#F3E5F5' },
                  { bg: '#8B6914', light: '#FDF3DC' },
                ]
                const c = colors[i % colors.length]
                return (
                  <Link
                    key={subject.id}
                    href={`/subject/${subject.id}?tab=ai`}
                    className="group bg-white rounded-2xl border p-4 hover:shadow-md transition-all flex items-center gap-4"
                    style={{ borderColor: 'var(--reva-border)', borderLeftWidth: 3, borderLeftColor: c.bg }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: c.bg }}
                    >
                      {subject.subject_code.slice(-3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--reva-navy)' }}>{subject.name}</p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--reva-muted)' }}>{subject.subject_code}</p>
                    </div>
                    <span className="text-sm group-hover:translate-x-1 transition-transform" style={{ color: 'var(--reva-muted)' }}>→</span>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
