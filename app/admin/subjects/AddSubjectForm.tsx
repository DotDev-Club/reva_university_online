'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Department { id: string; name: string; full_name: string }

export default function AddSubjectForm({ departments }: { departments: Department[] }) {
  const router = useRouter()
  const [deptId, setDeptId] = useState('')
  const [semester, setSemester] = useState('')
  const [subjectCode, setSubjectCode] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/admin/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deptId, semester: Number(semester), subjectCode, name }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.message ?? 'Failed to add subject.')
      setLoading(false)
      return
    }

    setSuccess(`Added: ${data.subject.subject_code} — ${data.subject.name}`)
    setSubjectCode('')
    setName('')
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
        <select
          required
          value={deptId}
          onChange={e => setDeptId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
        >
          <option value="">Select</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
        <select
          required
          value={semester}
          onChange={e => setSemester(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
        >
          <option value="">Select</option>
          {Array.from({ length: 8 }, (_, i) => i + 1).map(s => (
            <option key={s} value={s}>Semester {s}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
        <input
          type="text"
          required
          value={subjectCode}
          onChange={e => setSubjectCode(e.target.value.toUpperCase())}
          placeholder="e.g. CS301"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Operating Systems"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
        />
      </div>

      {error && (
        <p className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="col-span-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          ✓ {success}
        </p>
      )}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#1E3A5F] px-5 py-2 text-sm font-medium text-white hover:bg-[#163049] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Adding...' : 'Add Subject'}
        </button>
      </div>
    </form>
  )
}
