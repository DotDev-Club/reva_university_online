import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getConfig } from '@/lib/app-config'
import BuyAccessButton from '@/components/BuyAccessButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: profile } = await supabaseAdmin
    .from('users')
    .select('full_name, dept_id, semester_current, subscription_semester, subscription_expires_at, is_early_user, email_verified')
    .eq('id', user.id)
    .single()

  // Fallback: auth callback may have been skipped (e.g. token_hash flow before fix).
  // Create the profile row here rather than loop-redirecting to /login.
  if (!profile) {
    const meta = user.user_metadata ?? {}
    const bumpMonths = 4.5
    const semesterAutoUpdateAt = new Date(Date.now() + bumpMonths * 30.44 * 86400000)
    const { data: claimed } = await supabaseAdmin.rpc('claim_early_user_slot')
    await supabaseAdmin.from('users').insert({
      id: user.id,
      email: user.email!,
      full_name: meta.full_name ?? user.email!.split('@')[0],
      dept_id: meta.dept_id ?? null,
      semester_current: meta.semester_current ?? 1,
      semester_auto_update_at: semesterAutoUpdateAt.toISOString(),
      is_early_user: claimed === true,
      email_verified: true,
    })
    const { data: newProfile } = await supabaseAdmin
      .from('users')
      .select('full_name, dept_id, semester_current, subscription_semester, subscription_expires_at, is_early_user, email_verified')
      .eq('id', user.id)
      .single()
    profile = newProfile
  }

  if (!profile) redirect('/login')

  if (!profile.email_verified) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className="bg-white rounded-2xl border p-8" style={{ borderColor: 'var(--reva-border)' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-4" style={{ background: 'var(--reva-orange-light)' }}>📧</div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--reva-navy)' }}>Verify your email</h2>
          <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>
            Check your inbox for a verification link before accessing your dashboard.
          </p>
        </div>
      </div>
    )
  }

  const { data: subjects } = await supabaseAdmin
    .from('subjects')
    .select('id, name, subject_code, semester')
    .eq('dept_id', profile.dept_id)
    .eq('semester', profile.semester_current)
    .eq('is_active', true)
    .order('subject_code')

  const isSubscribed =
    profile.is_early_user ||
    (profile.subscription_expires_at !== null && new Date(profile.subscription_expires_at) > new Date())

  const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
  const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null

  const priceInr = await getConfig('subscription_price_inr')

  const { data: mockPapers } = await supabaseAdmin
    .from('mock_papers')
    .select('id, exam_date, release_at, released, subject:subjects(id, name, semester)')
    .order('exam_date')
    .limit(5)

  const firstName = profile.full_name.split(' ')[0]

  return (
    <div className="space-y-6">
      {/* Welcome banner — Reva portal orange bar style */}
      <div className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4" style={{ background: 'var(--reva-orange)' }}>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
            {firstName[0].toUpperCase()}
          </div>
          <div className="text-white">
            <p className="font-bold text-lg leading-tight">Welcome, {firstName}!</p>
            <p className="text-sm opacity-80">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        {profile.is_early_user ? (
          <span className="shrink-0 rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
            ★ Early Access
          </span>
        ) : isSubscribed ? (
          <span className="shrink-0 rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
            Sem {profile.subscription_semester} · {daysRemaining}d left
          </span>
        ) : null}
      </div>

      {/* Upgrade card — shown when not subscribed */}
      {!isSubscribed && (
        <div className="rounded-2xl border p-5 flex items-center justify-between gap-4 bg-white" style={{ borderColor: '#FDDBB4', borderLeftWidth: 4, borderLeftColor: 'var(--reva-orange)' }}>
          <div>
            <p className="font-semibold" style={{ color: 'var(--reva-navy)' }}>
              Unlock Semester {profile.semester_current} — ₹{priceInr}
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--reva-muted)' }}>
              Units 2–4 · Mock Papers · AI Q&amp;A · 6 months access
            </p>
          </div>
          <BuyAccessButton semester={profile.semester_current} priceInr={priceInr} />
        </div>
      )}

      {/* Stats row — Reva card style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Current Semester', value: `Semester ${profile.semester_current}`, color: 'var(--reva-teal)', bg: 'var(--reva-teal-light)' },
          { label: 'Subjects', value: subjects?.length ?? 0, color: 'var(--reva-orange)', bg: 'var(--reva-orange-light)' },
          { label: 'Subscription', value: isSubscribed ? (profile.is_early_user ? 'Free Access' : `${daysRemaining}d left`) : 'Not active', color: isSubscribed ? '#1B9E8B' : '#9B2D8E', bg: isSubscribed ? 'var(--reva-teal-light)' : '#F3E5F5' },
          { label: 'Mock Papers', value: mockPapers?.filter(p => p.released).length ?? 0, color: '#8B6914', bg: '#FDF3DC' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border p-4" style={{ borderColor: 'var(--reva-border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--reva-muted)' }}>{stat.label}</p>
            <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Subjects grid */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold" style={{ color: 'var(--reva-navy)' }}>
            Semester {profile.semester_current} Subjects
          </h2>
          <Link href="/dashboard/settings" className="text-xs font-medium hover:underline" style={{ color: 'var(--reva-orange)' }}>
            Change semester →
          </Link>
        </div>

        {!subjects || subjects.length === 0 ? (
          <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--reva-border)' }}>
            <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>No subjects available yet.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject, i) => {
              const cardColors = [
                { bg: 'var(--reva-teal)', light: 'var(--reva-teal-light)' },
                { bg: 'var(--reva-orange)', light: 'var(--reva-orange-light)' },
                { bg: '#8E24AA', light: '#F3E5F5' },
                { bg: '#8B6914', light: '#FDF3DC' },
              ]
              const cc = cardColors[i % cardColors.length]
              return (
                <Link
                  key={subject.id}
                  href={`/subject/${subject.id}`}
                  className="group bg-white rounded-2xl border p-5 hover:shadow-md transition-all"
                  style={{ borderColor: 'var(--reva-border)', borderTopWidth: 3, borderTopColor: cc.bg }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white" style={{ background: cc.bg }}>
                      {subject.subject_code.slice(0, 3)}
                    </div>
                    {isSubscribed && profile.subscription_semester === subject.semester ? (
                      <span className="text-xs font-medium rounded-full px-2 py-0.5" style={{ background: 'var(--reva-teal-light)', color: 'var(--reva-teal)' }}>
                        Unlocked
                      </span>
                    ) : (
                      <span className="text-xs rounded-full px-2 py-0.5" style={{ background: 'var(--reva-orange-light)', color: 'var(--reva-orange)' }}>
                        Preview
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono mb-0.5" style={{ color: 'var(--reva-muted)' }}>{subject.subject_code}</p>
                  <p className="font-semibold text-sm group-hover:underline" style={{ color: 'var(--reva-navy)' }}>{subject.name}</p>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Mock Papers */}
      <section>
        <h2 className="font-bold mb-3" style={{ color: 'var(--reva-navy)' }}>Upcoming Mock Papers</h2>
        {!mockPapers || mockPapers.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>No upcoming mock papers.</p>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--reva-border)' }}>
            {mockPapers.map((paper, i) => {
              const subject = Array.isArray(paper.subject) ? paper.subject[0] : paper.subject
              const examDate = new Date(paper.exam_date)
              const daysToExam = Math.ceil((examDate.getTime() - Date.now()) / 86400000)
              const canAccess = isSubscribed && paper.released

              return (
                <div key={paper.id} className={`flex items-center justify-between px-5 py-3.5 ${i > 0 ? 'border-t' : ''}`} style={{ borderColor: 'var(--reva-border)' }}>
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--reva-navy)' }}>{(subject as any)?.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--reva-muted)' }}>
                      {examDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {daysToExam > 0 && ` · ${daysToExam}d away`}
                    </p>
                  </div>
                  {canAccess ? (
                    <Link href={`/mock-paper/${paper.id}`} className="btn-reva text-xs px-3 py-1.5">
                      View Paper
                    </Link>
                  ) : paper.released ? (
                    <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--reva-orange-light)', color: 'var(--reva-orange)' }}>
                      🔒 Subscribe
                    </span>
                  ) : (
                    <span className="text-xs rounded-full px-2.5 py-1" style={{ background: 'var(--reva-navy-light)', color: 'var(--reva-muted)' }}>
                      {daysToExam > 1 ? `In ${daysToExam}d` : 'Tomorrow'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
