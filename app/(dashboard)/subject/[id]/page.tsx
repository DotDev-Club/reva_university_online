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
