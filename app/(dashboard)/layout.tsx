import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('full_name, email, semester_current')
    .eq('id', user.id)
    .single()

  const fullName = profile?.full_name ?? user.email ?? 'Student'
  const email = profile?.email ?? user.email ?? ''
  const semester = profile?.semester_current ?? 1

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--reva-bg)' }}>
      <NavBar fullName={fullName} email={email} semester={semester} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
