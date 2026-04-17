'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props { fullName: string; email: string; semester: number }

const NAV = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/dashboard/papers',
    label: 'Mock Papers',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M9 12h6M9 16h4M7 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-2" />
        <rect x="7" y="1" width="10" height="6" rx="1" />
      </svg>
    ),
  },
  {
    href: '/dashboard/ai',
    label: 'AI Chat',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

export default function NavBar({ fullName, email, semester }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [dropOpen, setDropOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); setDropOpen(false) }, [pathname])

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = fullName.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()

  function active(href: string) {
    return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
  }

  return (
    <>
      <header className="bg-white border-b sticky top-0 z-40" style={{ borderColor: 'var(--reva-border)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">

          {/* ── Logo ── */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 mr-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs tracking-tight"
              style={{ background: 'var(--reva-orange)' }}
            >
              RU
            </div>
            <span className="font-bold text-sm tracking-tight hidden sm:block" style={{ color: 'var(--reva-navy)' }}>
              REVA UNIVERSITY
            </span>
          </Link>

          {/* ── Desktop nav ── */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV.map(({ href, label, icon }) => {
              const on = active(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all select-none"
                  style={on
                    ? { background: 'var(--reva-orange-light)', color: 'var(--reva-orange)' }
                    : { color: 'var(--reva-muted)' }
                  }
                >
                  <span style={{ color: on ? 'var(--reva-orange)' : 'var(--reva-muted)' }}>{icon}</span>
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* ── Right side ── */}
          <div className="ml-auto flex items-center gap-2">

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--reva-border)' }}
              aria-label="Menu"
            >
              {mobileOpen
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
              }
            </button>

            {/* Profile dropdown */}
            <div className="relative" ref={dropRef}>
              <button
                onClick={() => setDropOpen(v => !v)}
                className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl border transition-all hover:border-gray-300 hover:shadow-sm"
                style={{ borderColor: 'var(--reva-border)' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: 'var(--reva-navy)' }}
                >
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col text-left min-w-0">
                  <span className="text-xs font-semibold leading-tight truncate max-w-24" style={{ color: 'var(--reva-navy)' }}>
                    {fullName.split(' ')[0]}
                  </span>
                  <span className="text-xs leading-tight" style={{ color: 'var(--reva-muted)' }}>
                    Sem {semester}
                  </span>
                </div>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className="hidden sm:block shrink-0"
                  style={{ color: 'var(--reva-muted)', transform: dropOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Dropdown panel */}
              {dropOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border overflow-hidden z-50"
                  style={{ borderColor: 'var(--reva-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
                >
                  {/* User info */}
                  <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--reva-border)' }}>
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: 'var(--reva-navy)' }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--reva-navy)' }}>{fullName}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--reva-muted)' }}>{email}</p>
                      <span
                        className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: 'var(--reva-orange-light)', color: 'var(--reva-orange)' }}
                      >
                        Semester {semester}
                      </span>
                    </div>
                  </div>

                  {/* Nav links */}
                  <div className="py-1.5">
                    {NAV.map(({ href, label, icon }) => {
                      const on = active(href)
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setDropOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
                          style={{ color: on ? 'var(--reva-orange)' : 'var(--reva-text)', fontWeight: on ? 500 : 400 }}
                        >
                          <span style={{ color: on ? 'var(--reva-orange)' : 'var(--reva-muted)' }}>{icon}</span>
                          <span className="flex-1">{label}</span>
                          {on && (
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--reva-orange)' }} />
                          )}
                        </Link>
                      )
                    })}
                  </div>

                  {/* Sign out */}
                  <div className="px-2 pb-2 pt-1 border-t" style={{ borderColor: 'var(--reva-border)' }}>
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-red-50"
                      style={{ color: '#DC2626' }}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile slide-down menu ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed top-16 left-0 right-0 z-30 bg-white border-b"
          style={{ borderColor: 'var(--reva-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
        >
          {/* User info strip */}
          <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--reva-border)', background: 'var(--reva-bg)' }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: 'var(--reva-navy)' }}
            >
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--reva-navy)' }}>{fullName}</p>
              <p className="text-xs" style={{ color: 'var(--reva-muted)' }}>Semester {semester}</p>
            </div>
          </div>

          {/* Nav links */}
          {NAV.map(({ href, label, icon }) => {
            const on = active(href)
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium border-b transition-colors"
                style={{
                  borderColor: 'var(--reva-border)',
                  color: on ? 'var(--reva-orange)' : 'var(--reva-text)',
                  background: on ? 'var(--reva-orange-light)' : 'transparent',
                }}
              >
                <span style={{ color: on ? 'var(--reva-orange)' : 'var(--reva-muted)' }}>{icon}</span>
                {label}
              </Link>
            )
          })}

          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium"
            style={{ color: '#DC2626' }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </>
  )
}
