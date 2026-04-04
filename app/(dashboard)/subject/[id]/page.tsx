// Subject page — unit list with access states.
// Dashboard query uses semester_current; access checks use subscription_semester (Rule C4).
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserAccessFields, canAccessMaterial, getSchemeSubjectSemester } from '@/lib/access-control'
import { getConfig } from '@/lib/app-config'
import MaterialViewer from '@/components/MaterialViewer'
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
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-900">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{subject.name}</span>
      </div>

      {/* Subject header */}
      <div>
        <p className="text-xs text-gray-400 font-mono">{subject.subject_code} · Semester {subject.semester} · {(dept as any)?.name}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{subject.name}</h1>
      </div>

      {/* Upgrade banner */}
      {!isSubscribedToThisSemester && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-amber-900 text-sm">
              Unlock Units 2–4, Mock Papers &amp; AI Q&amp;A
            </p>
            <p className="text-amber-700 text-xs mt-0.5">₹{priceInr} for Semester {subject.semester} · 6 months access</p>
          </div>
          <BuyAccessButton semester={subject.semester} priceInr={priceInr} />
        </div>
      )}

      {/* Units */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Units</h2>
        {unitsWithAccess.length === 0 && (
          <p className="text-gray-500 text-sm">No materials uploaded yet.</p>
        )}
        {unitsWithAccess.map(unit => (
          <div key={unit.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <span className="text-xs text-gray-400 font-medium">Unit {unit.unit_no}</span>
                <p className="font-medium text-gray-900">{unit.title}</p>
                {unit.topics.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {unit.topics.slice(0, 3).join(' · ')}
                    {unit.topics.length > 3 && ` +${unit.topics.length - 3} more`}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {unit.access.allowed ? (
                  <span className="text-xs font-medium text-emerald-700">
                    {unit.unit_no === 2 && !userFields.is_early_user && unit.is_free
                      ? `First ${freeUnit2Pct}%`
                      : 'Full access'}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">🔒 Locked</span>
                )}
              </div>
            </div>

            {/* PDF Viewer — only rendered if access is allowed */}
            {unit.access.allowed && (
              <MaterialViewer
                materialId={unit.id}
                unitNo={unit.unit_no}
                isFreeUnit2={unit.unit_no === 2 && unit.is_free && !userFields.is_early_user}
                freeUnit2Pct={freeUnit2Pct}
                needsOcr={unit.needs_ocr}
              />
            )}

            {/* Paywall overlay for locked units */}
            {!unit.access.allowed && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-500">
                  {unit.access.reason === 'EXPIRED'
                    ? 'Your subscription has expired.'
                    : unit.access.reason === 'WRONG_SEMESTER'
                    ? `Your subscription covers Semester ${userFields.subscription_semester}.`
                    : 'Upgrade to access this unit.'}
                </p>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Claude Q&A */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          AI Q&amp;A — Ask about {subject.name}
        </h2>
        {isSubscribedToThisSemester ? (
          <QAPanel subjectId={subject.id} subjectName={subject.name} />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-gray-500 text-sm">AI Q&amp;A is a paid feature.</p>
            <p className="text-gray-400 text-xs mt-1">Upgrade to ask unlimited questions (up to 20/day).</p>
          </div>
        )}
      </section>
    </div>
  )
}
