// Subject page — unit list with access states.
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserAccessFields, canAccessMaterial, getSchemeSubjectSemester } from '@/lib/access-control'
import { getConfig } from '@/lib/app-config'
import SubjectTabs from '@/components/SubjectTabs'
import BuyAccessButton from '@/components/BuyAccessButton'

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id: subjectId } = await params
  const { tab: initialTab } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: subject } = await supabaseAdmin
    .from('subjects')
    .select('id, name, subject_code, semester, dept:departments(name)')
    .eq('id', subjectId)
    .eq('is_active', true)
    .single()

  if (!subject) notFound()

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
  const resolvedSemester = (await getSchemeSubjectSemester(subjectId, user.id, schemeId)) ?? subject.semester

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

  const unitGroups = Object.entries(
    unitsWithAccess.reduce<Record<number, typeof unitsWithAccess>>((acc, mat) => {
      if (!acc[mat.unit_no]) acc[mat.unit_no] = []
      acc[mat.unit_no].push(mat)
      return acc
    }, {})
  )
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([unit_no, mats]) => ({ unit_no: Number(unit_no), materials: mats }))

  return (
    <div className="space-y-5 max-w-4xl">
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

      {/* Subject header card */}
      <div
        className="bg-white rounded-2xl border p-5 flex items-start justify-between gap-4"
        style={{ borderColor: 'var(--reva-border)', borderTopWidth: 3, borderTopColor: 'var(--reva-orange)' }}
      >
        <div>
          <p className="text-xs font-mono mb-1" style={{ color: 'var(--reva-muted)' }}>
            {subject.subject_code} · Semester {subject.semester} · {(dept as any)?.name}
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--reva-navy)' }}>{subject.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--reva-teal-light)', color: 'var(--reva-teal)' }}>
              Unit 1 Free
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--reva-orange-light)', color: 'var(--reva-orange)' }}>
              Units 2–4 Paid
            </span>
            <span className="text-xs" style={{ color: 'var(--reva-muted)' }}>
              {unitGroups.length} units · {unitsWithAccess.length} materials
            </span>
          </div>
        </div>
        {!isSubscribedToThisSemester && (
          <div className="shrink-0 text-right">
            <p className="text-xs mb-2" style={{ color: 'var(--reva-muted)' }}>₹{priceInr} · 6 months</p>
            <BuyAccessButton semester={subject.semester} priceInr={priceInr} />
          </div>
        )}
        {isSubscribedToThisSemester && (
          <span className="shrink-0 text-xs px-3 py-1 rounded-full font-medium" style={{ background: 'var(--reva-teal-light)', color: 'var(--reva-teal)' }}>
            ✓ Unlocked
          </span>
        )}
      </div>

      {/* Tab layout: Units | Syllabus | AI Q&A */}
      <SubjectTabs
        units={unitGroups}
        isEarlyUser={userFields.is_early_user}
        subscriptionSemester={userFields.subscription_semester}
        freeUnit2Pct={freeUnit2Pct}
        watermark={user.email}
        subjectId={subject.id}
        subjectName={subject.name}
        isSubscribed={isSubscribedToThisSemester}
        allMaterials={unitsWithAccess}
        initialTab={initialTab === 'ai' ? 'AI Q&A' : undefined}
      />
    </div>
  )
}
