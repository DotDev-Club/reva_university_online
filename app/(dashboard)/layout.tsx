import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--reva-bg)' }}>
      {/* Top header — Reva portal style */}
      <header className="bg-white border-b sticky top-0 z-10" style={{ borderColor: 'var(--reva-border)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: 'var(--reva-orange)' }}>
              RU
            </div>
            <span className="font-bold text-sm hidden sm:block" style={{ color: 'var(--reva-navy)' }}>
              REVA UNIVERSITY
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {[
              { href: '/dashboard', label: 'Home' },
              { href: '/dashboard/settings', label: 'Settings' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100"
                style={{ color: 'var(--reva-muted)' }}
              >
                {label}
              </Link>
            ))}
          </nav>

          <SignOutButton />
        </div>
      </header>

      {/* Orange accent bar — matches Reva portal */}
      <div className="h-1" style={{ background: 'var(--reva-orange)' }} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  )
}
