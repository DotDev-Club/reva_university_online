'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('rajasaipranav0@gmail.com')
  const [password, setPassword] = useState('admin@123')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: 'var(--reva-border)' }}>
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--reva-navy)' }}>Welcome back</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--reva-muted)' }}>Log in to your student account</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>
            Email
          </label>
          <input
            id="email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:ring-2"
            style={{ borderColor: 'var(--reva-border)', '--tw-ring-color': 'var(--reva-orange)' } as any}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>
            Password
          </label>
          <input
            id="password" type="password" required autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:ring-2"
            style={{ borderColor: 'var(--reva-border)', '--tw-ring-color': 'var(--reva-orange)' } as any}
          />
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2.5 text-sm border" style={{ background: '#FFF0F0', borderColor: '#FFCDD2', color: '#B71C1C' }}>
            {error}
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="btn-reva w-full py-2.5 text-center"
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: 'var(--reva-muted)' }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-semibold hover:underline" style={{ color: 'var(--reva-orange)' }}>
          Sign up free
        </Link>
      </p>
    </div>
  )
}
