'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Department { id: string; name: string; full_name: string }
interface Scheme { id: string; name: string; batch_start: number; batch_end: number }

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-all focus:ring-2 bg-white'
const inputStyle = { borderColor: 'var(--reva-border)', '--tw-ring-color': 'var(--reva-orange)' } as any

export default function SignupForm({ departments }: { departments: Department[] }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [deptId, setDeptId] = useState('')
  const [admissionYear, setAdmissionYear] = useState('')
  const [schemes, setSchemes] = useState<Scheme[]>([])
  const [schemesLoading, setSchemesLoading] = useState(false)
  const [semester, setSemester] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loadSchemes(newDeptId: string) {
    if (!newDeptId) { setSchemes([]); setAdmissionYear(''); return }
    setSchemesLoading(true)
    const res = await fetch(`/api/schemes?deptId=${newDeptId}`)
    const data = await res.json()
    setSchemes(data.schemes ?? [])
    setAdmissionYear('')
    setSchemesLoading(false)
  }

  function handleDeptChange(val: string) {
    setDeptId(val)
    setAdmissionYear('')
    setSchemes([])
    loadSchemes(val)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
        deptId,
        semesterCurrent: Number(semester),
        admissionYear: Number(admissionYear),
      }),
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

  const noSchemesForDept = deptId && !schemesLoading && schemes.length === 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: 'var(--reva-border)' }}>
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--reva-navy)' }}>Create your account</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--reva-muted)' }}>Access your semester notes, mock papers &amp; AI Q&amp;A</p>

      <form onSubmit={handleSignup} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>Full Name</label>
            <input type="text" required autoComplete="name" placeholder="As on college ID"
              value={fullName} onChange={e => setFullName(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>Phone Number</label>
            <input type="tel" required autoComplete="tel" placeholder="10-digit mobile"
              pattern="[0-9]{10}" maxLength={10}
              value={phone} onChange={e => setPhone(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
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

        {/* Branch / Department */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>Branch / Department</label>
          <select required value={deptId} onChange={e => handleDeptChange(e.target.value)}
            className={inputCls} style={inputStyle}>
            <option value="">Select branch</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name} — {d.full_name}</option>)}
          </select>
        </div>

        {/* Admission year — cascade loads after dept */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>Admission Year (Batch)</label>
          <select
            required
            value={admissionYear}
            disabled={!deptId || schemesLoading}
            onChange={e => setAdmissionYear(e.target.value)}
            className={inputCls + ' disabled:opacity-50'}
            style={inputStyle}
          >
            <option value="">
              {schemesLoading ? 'Loading batches...' : !deptId ? 'Select branch first' : 'Select your batch'}
            </option>
            {schemes.map(s => (
              <option key={s.id} value={s.batch_start}>
                {s.batch_start}–{s.batch_end} batch
              </option>
            ))}
          </select>
          {noSchemesForDept && (
            <p className="text-xs mt-1" style={{ color: 'var(--reva-orange)' }}>
              No batches configured for this branch yet — contact support.
            </p>
          )}
        </div>

        {/* Current semester */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--reva-text)' }}>Current Semester</label>
          <select required value={semester} onChange={e => setSemester(e.target.value)}
            className={inputCls} style={inputStyle}>
            <option value="">Select semester</option>
            {Array.from({ length: 8 }, (_, i) => i + 1).map(s => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2.5 text-sm border" style={{ background: '#FFF0F0', borderColor: '#FFCDD2', color: '#B71C1C' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !!noSchemesForDept}
          className="btn-reva w-full py-2.5 text-center"
        >
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
