'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Department { id: string; name: string }
interface Subject { id: string; name: string; subject_code: string }

export default function AddMockPaperForm({ departments }: { departments: Department[] }) {
  const router = useRouter()
  const [deptId, setDeptId] = useState('')
  const [semester, setSemester] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [examDate, setExamDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadSubjects(dId: string, sem: string) {
    if (!dId || !sem) { setSubjects([]); return }
    setSubjectsLoading(true)
    const res = await fetch(`/api/admin/subjects?deptId=${dId}&semester=${sem}`)
    const data = await res.json()
    setSubjects(data.subjects ?? [])
    setSubjectId('')
    setSubjectsLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !subjectId || !examDate) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    const form = new FormData()
    form.append('file', file)
    form.append('subjectId', subjectId)
    form.append('examDate', examDate)

    const res = await fetch('/api/admin/mock-papers', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setError(data.message ?? 'Failed to add mock paper.')
      setLoading(false)
      return
    }

    const paper = data.mockPaper
    setSuccess(
      `Added. Exam: ${new Date(paper.exam_date).toLocaleDateString('en-IN')} · Releases: ${new Date(paper.release_at).toLocaleString('en-IN')}`
    )
    setFile(null)
    setExamDate('')
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
          onChange={e => { setDeptId(e.target.value); setSemester(''); setSubjects([]) }}
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
          disabled={!deptId}
          onChange={e => { setSemester(e.target.value); loadSubjects(deptId, e.target.value) }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:opacity-50"
        >
          <option value="">Select</option>
          {Array.from({ length: 8 }, (_, i) => i + 1).map(s => (
            <option key={s} value={s}>Semester {s}</option>
          ))}
        </select>
      </div>

      <div className="col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
        <select
          required
          value={subjectId}
          disabled={!semester || subjectsLoading}
          onChange={e => setSubjectId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:opacity-50"
        >
          <option value="">{subjectsLoading ? 'Loading...' : 'Select subject'}</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_code} — {s.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Exam Date</label>
        <input
          type="date"
          required
          value={examDate}
          onChange={e => setExamDate(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
        <input
          type="file"
          required
          accept="application/pdf"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1E3A5F] file:text-white file:px-3 file:py-1.5 file:text-sm file:cursor-pointer"
        />
      </div>

      {error && <p className="col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="col-span-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">✓ {success}</p>}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={loading || !file || !subjectId || !examDate}
          className="rounded-lg bg-[#1E3A5F] px-5 py-2 text-sm font-medium text-white hover:bg-[#163049] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Uploading...' : 'Add Mock Paper'}
        </button>
      </div>
    </form>
  )
}
