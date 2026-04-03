'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Department { id: string; name: string; full_name: string }

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:ring-2 bg-white'
const inputStyle = { borderColor: 'var(--reva-border)', '--tw-ring-color': 'var(--reva-orange)' } as any

export default function SignupForm({ departments }: { departments: Department[] }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [deptId, setDeptId] = useState('')
  const [semester, setSemester] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, fullName: fullName.trim(), deptId, semesterCurrent: Number(semester) }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.message ?? 'Signup failed.'); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border p-8 text-center" style={{ borderColor: 'var(--reva-border)' }}>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-4" style={{ background: 'var(--reva-orange-light)' }}>📧</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--reva-navy)' }}>Check your email</h2>
        <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>
          We sent a verification link to <strong>{email}</strong>.<br />Click it to activate your account and claim your access.
        </p>
      </div>
    )
  }

  if (departments.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border p-8 text-center" style={{ borderColor: 'var(--reva-border)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl mx-auto mb-3" style={{ background: 'var(--reva-orange-light)' }}>🚧</div>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--reva-navy)' }}>Coming Soon</h2>
        <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>Department content is being set up. Check back shortly.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: 'var(--reva-border)' }}>
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--reva-navy)' }}>Create your account</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--reva-muted)' }}>
        First 150 students get{' '}
        <span className="font-semibold" style={{ color: 'var(--reva-orange)' }}>free premium access</span>
      </p>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>Full Name</label>
          <input type="text" required autoComplete="name" placeholder="As on your college ID"
            value={fullName} onChange={e => setFullName(e.target.value)}
            className={inputCls} style={inputStyle} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>Email</label>
          <input type="email" required autoComplete="email" placeholder="your@email.com"
            value={email} onChange={e => setEmail(e.target.value)}
            className={inputCls} style={inputStyle} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>Password</label>
          <input type="password" required autoComplete="new-password" minLength={8} placeholder="Min. 8 characters"
            value={password} onChange={e => setPassword(e.target.value)}
            className={inputCls} style={inputStyle} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>Department</label>
            <select required value={deptId} onChange={e => setDeptId(e.target.value)}
              className={inputCls} style={inputStyle}>
              <option value="">Select</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>Semester</label>
            <select required value={semester} onChange={e => setSemester(e.target.value)}
              className={inputCls} style={inputStyle}>
              <option value="">Select</option>
              {Array.from({ length: 8 }, (_, i) => i + 1).map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2.5 text-sm border" style={{ background: '#FFF0F0', borderColor: '#FFCDD2', color: '#B71C1C' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-reva w-full py-2.5 text-center">
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: 'var(--reva-muted)' }}>
        Already have an account?{' '}
        <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--reva-orange)' }}>Log in</Link>
      </p>
    </div>
  )
}
