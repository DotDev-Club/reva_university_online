'use client'
// Rule C3: manual semester updates are bounded to ±1 of current, or any lower value.
// Enforced both client-side (UX) and server-side (API route).

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SemesterUpdateForm({ currentSemester }: { currentSemester: number }) {
  const router = useRouter()
  const [selected, setSelected] = useState(currentSemester)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Rule C3: only allow values ≤ current or current+1, and within 1–8
  const allowedSemesters = Array.from({ length: 8 }, (_, i) => i + 1).filter(
    s => s <= currentSemester || s === currentSemester + 1
  )

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (selected === currentSemester) return

    setLoading(true)
    setMessage(null)

    const res = await fetch('/api/user/update-semester', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ semesterCurrent: selected }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setMessage({ type: 'error', text: data.message ?? 'Update failed.' })
      return
    }

    setMessage({ type: 'success', text: 'Semester updated.' })
    router.refresh()
  }

  return (
    <form onSubmit={handleUpdate} className="flex items-end gap-3">
      <div>
        <label htmlFor="semester" className="block text-sm font-medium text-gray-700 mb-1">
          Semester
        </label>
        <select
          id="semester"
          value={selected}
          onChange={e => setSelected(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white"
        >
          {allowedSemesters.map(s => (
            <option key={s} value={s}>
              Semester {s}{s === currentSemester ? ' (current)' : ''}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading || selected === currentSemester}
        className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#163049] disabled:opacity-50 transition-colors"
      >
        {loading ? 'Saving...' : 'Save'}
      </button>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </form>
  )
}
