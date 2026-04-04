import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SemesterUpdateForm from './SemesterUpdateForm'
import ElectiveChooser from './ElectiveChooser'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('full_name, email, semester_current, subscription_semester, subscription_expires_at, is_early_user, scheme_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Fetch elective slots for current semester (if scheme assigned)
  let electiveGroupsData: Record<string, { id: string; name: string; subject_code: string; course_type: string }[]> = {}
  let chosenElectives: Record<string, string> = {} // elective_group → subject_id

  if (profile.scheme_id) {
    const { data: options } = await supabaseAdmin
      .from('scheme_subjects')
      .select('elective_group, subject:subjects(id, name, subject_code, course_type)')
      .eq('scheme_id', profile.scheme_id)
      .eq('semester', profile.semester_current)
      .eq('is_elective', true)
      .eq('is_active', true)

    for (const row of options ?? []) {
      const group = row.elective_group!
      const sub = Array.isArray(row.subject) ? row.subject[0] : row.subject as any
      if (!electiveGroupsData[group]) electiveGroupsData[group] = []
      electiveGroupsData[group].push(sub)
    }

    const { data: chosen } = await supabaseAdmin
      .from('user_elective_choices')
      .select('elective_group, subject_id')
      .eq('user_id', user.id)
      .eq('scheme_id', profile.scheme_id)

    for (const c of chosen ?? []) {
      chosenElectives[c.elective_group] = c.subject_id
    }
  }

  const isSubscribed =
    profile.is_early_user ||
    (profile.subscription_expires_at !== null &&
      new Date(profile.subscription_expires_at) > new Date())

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your profile and semester</p>
      </div>

      {/* Profile info */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Account</h2>
        <div>
          <p className="text-xs text-gray-500">Name</p>
          <p className="text-sm text-gray-900">{profile.full_name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Email</p>
          <p className="text-sm text-gray-900">{profile.email}</p>
        </div>
        {isSubscribed && (
          <div>
            <p className="text-xs text-gray-500">Subscription</p>
            <p className="text-sm text-gray-900">
              {profile.is_early_user
                ? 'Early Access (free)'
                : `Semester ${profile.subscription_semester} — expires ${new Date(profile.subscription_expires_at!).toLocaleDateString('en-IN')}`}
            </p>
          </div>
        )}
      </section>

      {/* Semester update — bounded by Rule C3 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Current Semester</h2>
        <p className="text-xs text-gray-500 mb-4">
          You can move ±1 semester from your current semester, or to any lower semester.
          This does not affect your subscription scope.
        </p>
        <SemesterUpdateForm currentSemester={profile.semester_current ?? 1} />
      </section>

      {/* Elective chooser — only shown when scheme has elective slots this semester */}
      {Object.keys(electiveGroupsData).length > 0 && profile.scheme_id && (
        <section id="electives" className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Elective Subjects</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose one subject per elective slot for Semester {profile.semester_current}.
              You can change your choice anytime before first paid access.
            </p>
          </div>
          <ElectiveChooser
            schemeId={profile.scheme_id}
            electiveGroups={electiveGroupsData}
            chosenElectives={chosenElectives}
          />
        </section>
      )}
    </div>
  )
}
