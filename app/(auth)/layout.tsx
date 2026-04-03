import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--reva-bg)' }}>
      {/* Thin branded top bar */}
      <div className="h-1 w-full" style={{ background: 'var(--reva-orange)' }} />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'var(--reva-orange)' }}>
                RU
              </div>
              <div className="text-left">
                <p className="font-bold text-sm leading-tight" style={{ color: 'var(--reva-navy)' }}>REVA UNIVERSITY</p>
                <p className="text-xs" style={{ color: 'var(--reva-muted)' }}>Student Resource Portal</p>
              </div>
            </Link>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
