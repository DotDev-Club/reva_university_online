// Subject page — unit list with access states.
// Dashboard query uses semester_current; access checks use subscription_semester (Rule C4).
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserAccessFields, canAccessMaterial, getSchemeSubjectSemester } from '@/lib/access-control'
import { getConfig } from '@/lib/app-config'
import UnitAccordion from '@/components/UnitAccordion'
import QAPanel from '@/components/QAPanel'
import BuyAccessButton from '@/components/BuyAccessButton'

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: subjectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch subject
  const { data: subject } = await supabaseAdmin
    .from('subjects')
    .select('id, name, subject_code, semester, dept:departments(name)')
    .eq('id', subjectId)
    .eq('is_active', true)
    .single()

  if (!subject) notFound()

  // Fetch materials (metadata only — no file_url exposed here)
  const { data: materials } = await supabaseAdmin
    .from('materials')
    .select('id, unit_no, title, topics, is_free, needs_ocr')
    .eq('subject_id', subjectId)
    .eq('is_active', true)
    .order('unit_no')

  const [userFields, priceInr, userProfile] = await Promise.all([
    getUserAccessFields(user.id),
    getConfig('subscription_price_inr'),
    supabaseAdmin.from('users').select('scheme_id').eq('id', user.id).single(),
  ])

  if (!userFields) redirect('/login')

  const schemeId = userProfile.data?.scheme_id ?? null

  // Resolve semester for this subject within the user's scheme
  // Falls back to subjects.semester for legacy users
  const resolvedSemester = (await getSchemeSubjectSemester(subjectId, user.id, schemeId)) ?? subject.semester

  // Compute access for each unit server-side
  const unitsWithAccess = await Promise.all(
    (materials ?? []).map(async mat => {
      const access = await canAccessMaterial(userFields, {
        is_free: mat.is_free,
        unit_no: mat.unit_no,
        subject: { semester: resolvedSemester },
      })
      return { ...mat, access }
    })
  )

  const dept = Array.isArray(subject.dept) ? subject.dept[0] : subject.dept

  const isSubscribedToThisSemester =
    userFields.is_early_user ||
    (userFields.subscription_expires_at !== null &&
      new Date(userFields.subscription_expires_at) > new Date() &&
      userFields.subscription_semester === resolvedSemester)

  const freeUnit2Pct = await getConfig('free_unit2_page_pct')

  return (
    <div className="space-y-6">
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
          <span style={{ color: 'var(--reva-navy)', fontWeight: 500 }}>{subject.name}</span>
        </div>
      </div>

      {/* Subject header */}
      <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--reva-border)', borderTopWidth: 3, borderTopColor: 'var(--reva-orange)' }}>
        <p className="text-xs font-mono mb-1" style={{ color: 'var(--reva-muted)' }}>{subject.subject_code} · Semester {subject.semester} · {(dept as any)?.name}</p>
        <h1 className="text-xl font-bold" style={{ color: 'var(--reva-navy)' }}>{subject.name}</h1>
      </div>

      {/* Upgrade banner */}
      {!isSubscribedToThisSemester && (
        <div className="rounded-2xl border p-4 flex items-center justify-between gap-4" style={{ background: 'var(--reva-orange-light)', borderColor: '#FDDBB4', borderLeftWidth: 4, borderLeftColor: 'var(--reva-orange)' }}>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--reva-navy)' }}>
              Unlock Units 2–4, Mock Papers &amp; AI Q&amp;A
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--reva-orange-dark)' }}>₹{priceInr} for Semester {subject.semester} · 6 months access</p>
          </div>
          <BuyAccessButton semester={subject.semester} priceInr={priceInr} />
        </div>
      )}

      {/* Units */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--reva-muted)' }}>Units</h2>
        {unitsWithAccess.length === 0 ? (
          <p className="text-gray-500 text-sm">No materials uploaded yet.</p>
        ) : (
          <UnitAccordion
            units={Object.entries(
              unitsWithAccess.reduce<Record<number, typeof unitsWithAccess>>((acc, mat) => {
                if (!acc[mat.unit_no]) acc[mat.unit_no] = []
                acc[mat.unit_no].push(mat)
                return acc
              }, {})
            )
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([unit_no, materials]) => ({ unit_no: Number(unit_no), materials }))}
            isEarlyUser={userFields.is_early_user}
            subscriptionSemester={userFields.subscription_semester}
            freeUnit2Pct={freeUnit2Pct}
            watermark={user.email}
          />
        )}
      </section>

      {/* Claude Q&A */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--reva-muted)' }}>
          AI Q&amp;A — Ask about {subject.name}
        </h2>
        {isSubscribedToThisSemester ? (
          <QAPanel subjectId={subject.id} subjectName={subject.name} />
        ) : (
          <div className="rounded-2xl border p-6 text-center bg-white" style={{ borderColor: 'var(--reva-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mx-auto mb-3" style={{ background: '#F3E5F5' }}>🤖</div>
            <p className="font-medium text-sm" style={{ color: 'var(--reva-navy)' }}>AI Q&amp;A is a paid feature</p>
            <p className="text-xs mt-1" style={{ color: 'var(--reva-muted)' }}>Upgrade to ask unlimited questions (up to 20/day).</p>
          </div>
        )}
      </section>
    </div>
  )
}
