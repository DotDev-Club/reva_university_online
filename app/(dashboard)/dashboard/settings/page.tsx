import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SemesterUpdateForm from './SemesterUpdateForm'

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

  const isSubscribed =
    profile.is_early_user ||
    (profile.subscription_expires_at !== null &&
      new Date(profile.subscription_expires_at) > new Date())

  return (
    <div className="max-w-lg space-y-8">
      <div className="flex items-center gap-3">
        <a
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-white"
          style={{ borderColor: 'var(--reva-border)', color: 'var(--reva-navy)' }}
        >
          ← Back
        </a>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--reva-navy)' }}>Settings</h1>
          <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>Manage your profile and semester</p>
        </div>
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
        {isSubscribed && profile.subscription_expires_at && (
          <div>
            <p className="text-xs text-gray-500">Subscription</p>
            <p className="text-sm text-gray-900">
              Semester {profile.subscription_semester} — expires {new Date(profile.subscription_expires_at).toLocaleDateString('en-IN')}
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

    </div>
  )
}
