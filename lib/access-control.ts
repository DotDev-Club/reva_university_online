// Server-side access control — Section 4 of the build spec.
// NEVER run these checks client-side.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/app-config'

export type AccessResult =
  | { allowed: true }
  | { allowed: false; reason: 'EXPIRED' | 'WRONG_SEMESTER' | 'NOT_SUBSCRIBED' | 'NOT_YET_RELEASED' | 'NOT_PAID' }

interface UserAccessFields {
  is_early_user: boolean
  subscription_semester: number | null
  subscription_expires_at: string | null
}

interface MaterialAccessFields {
  is_free: boolean
  unit_no: number
  subject: { semester: number }
}

interface MockPaperAccessFields {
  released: boolean
  subject: { semester: number }
}

// Rule 4.1 — Material access
export async function canAccessMaterial(
  user: UserAccessFields,
  material: MaterialAccessFields
): Promise<AccessResult> {
  // Unit 1 is always free
  if (material.is_free) return { allowed: true }

  // Early users get full access
  if (user.is_early_user) return { allowed: true }

  // Must have an active subscription
  if (!user.subscription_expires_at || new Date(user.subscription_expires_at) < new Date()) {
    return { allowed: false, reason: 'EXPIRED' }
  }

  // Subscription scope lock — must match semester at purchase time
  if (material.subject.semester !== user.subscription_semester) {
    return { allowed: false, reason: 'WRONG_SEMESTER' }
  }

  return { allowed: true }
}

// Rule 4.2 — Mock paper access
export async function canAccessMockPaper(
  user: UserAccessFields,
  mockPaper: MockPaperAccessFields
): Promise<AccessResult> {
  // Must be subscribed or early user
  if (
    !user.is_early_user &&
    (!user.subscription_expires_at || new Date(user.subscription_expires_at) < new Date())
  ) {
    return { allowed: false, reason: 'NOT_SUBSCRIBED' }
  }

  if (!mockPaper.released) {
    return { allowed: false, reason: 'NOT_YET_RELEASED' }
  }

  // Semester scope lock (early users bypass this)
  if (!user.is_early_user && mockPaper.subject.semester !== user.subscription_semester) {
    return { allowed: false, reason: 'WRONG_SEMESTER' }
  }

  return { allowed: true }
}

// Fetch user access fields from DB (server-side)
export async function getUserAccessFields(userId: string): Promise<UserAccessFields | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('is_early_user, subscription_semester, subscription_expires_at')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as UserAccessFields
}

// Fetch material with its subject semester (server-side)
export async function getMaterialWithSemester(materialId: string): Promise<MaterialAccessFields | null> {
  const { data, error } = await supabaseAdmin
    .from('materials')
    .select('is_free, unit_no, subject:subjects(semester)')
    .eq('id', materialId)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  const subject = Array.isArray(data.subject) ? data.subject[0] : data.subject
  return { is_free: data.is_free, unit_no: data.unit_no, subject } as MaterialAccessFields
}

// Track first paid content access for refund eligibility (Appendix P §6.2)
export async function markFirstAccess(userId: string): Promise<void> {
  // Find the most recent captured payment for this user with no first_access_at
  const { data } = await supabaseAdmin
    .from('payments')
    .select('id, first_access_at')
    .eq('user_id', userId)
    .eq('status', 'captured')
    .is('first_access_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (data) {
    await supabaseAdmin
      .from('payments')
      .update({ first_access_at: new Date().toISOString() })
      .eq('id', data.id)
  }
}

// Check Unit 2 page access for free users (Rule A1 / F2)
export async function getUnit2PageLimit(): Promise<number> {
  return getConfig('free_unit2_page_pct')
}

// Resolve the semester a subject sits in for a given scheme.
// Checks core scheme_subjects first, then the user's elective choices.
// Returns null when not found — callers fall back to subjects.semester.
export async function getSchemeSubjectSemester(
  subjectId: string,
  userId: string,
  schemeId: string | null
): Promise<number | null> {
  if (!schemeId) return null

  // Core (HC/DC) subjects and elective options
  const { data: core } = await supabaseAdmin
    .from('scheme_subjects')
    .select('semester')
    .eq('subject_id', subjectId)
    .eq('scheme_id', schemeId)
    .eq('is_active', true)
    .maybeSingle()

  if (core) return core.semester

  // User's chosen elective that maps to this subject
  const { data: choice } = await supabaseAdmin
    .from('user_elective_choices')
    .select('scheme_subjects!inner(semester)')
    .eq('user_id', userId)
    .eq('scheme_id', schemeId)
    .eq('subject_id', subjectId)
    .maybeSingle()

  return (choice?.scheme_subjects as any)?.semester ?? null
}
