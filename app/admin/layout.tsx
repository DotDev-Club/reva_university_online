import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/upload', label: 'Upload' },
  { href: '/admin/materials', label: 'Materials' },
  { href: '/admin/departments', label: 'Departments' },
  { href: '/admin/subjects', label: 'Subjects' },
  { href: '/admin/mock-papers', label: 'Mock Papers' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--reva-bg)' }}>
      {/* Admin header — Reva navy with orange accent */}
      <header style={{ background: 'var(--reva-navy)' }}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: 'var(--reva-orange)' }}>
                RU
              </div>
              <span className="text-white font-bold text-sm hidden sm:block">Admin Panel</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <SignOutButton />
        </div>
        {/* Orange accent bar */}
        <div className="h-0.5" style={{ background: 'var(--reva-orange)' }} />
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">{children}</main>
    </div>
  )
}
