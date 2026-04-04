'use client'
// Admin upload form — cascading dept → semester → subject → unit.
// Submits to /api/admin/upload (multipart/form-data).
// Shows extracted topics and OCR status after upload.

import { useState } from 'react'

interface Department { id: string; name: string; full_name: string; is_active: boolean }
interface Subject { id: string; name: string; subject_code: string }

interface UploadResult {
  materialId: string
  needsOcr: boolean
  topics: string[]
  isFree: boolean
  message: string
}

export default function UploadForm({ departments }: { departments: Department[] }) {
  const [deptId, setDeptId] = useState('')
  const [semester, setSemester] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectsLoading, setSubjectsLoading] = useState(false)
  const [unitNo, setUnitNo] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isImagePdf, setIsImagePdf] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadSubjects(newDeptId: string, newSemester: string) {
    if (!newDeptId || !newSemester) {
      setSubjects([])
      setSubjectId('')
      return
    }
    setSubjectsLoading(true)
    const res = await fetch(
      `/api/admin/subjects?deptId=${newDeptId}&semester=${newSemester}`
    )
    const data = await res.json()
    setSubjects(data.subjects ?? [])
    setSubjectId('')
    setSubjectsLoading(false)
  }

  function handleDeptChange(val: string) {
    setDeptId(val)
    setSemester('')
    setSubjects([])
    setSubjectId('')
  }

  function handleSemesterChange(val: string) {
    setSemester(val)
    loadSubjects(deptId, val)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !subjectId || !unitNo || !title) return

    setUploading(true)
    setError(null)
    setResult(null)

    const form = new FormData()
    form.append('file', file)
    form.append('subjectId', subjectId)
    form.append('unitNo', unitNo)
    form.append('title', title)
    if (isImagePdf) form.append('isImagePdf', 'true')

    const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setError(data.message ?? 'Upload failed.')
      setUploading(false)
      return
    }

    setResult(data)
    setUploading(false)
    // Reset file input
    setFile(null)
    setTitle('')
    setUnitNo('')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {/* Department */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
        <select
          required
          value={deptId}
          onChange={e => handleDeptChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
        >
          <option value="">Select department</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.full_name}
              {!d.is_active ? ' (inactive)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Semester */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
        <select
          required
          value={semester}
          disabled={!deptId}
          onChange={e => handleSemesterChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:opacity-50"
        >
          <option value="">Select semester</option>
          {Array.from({ length: 8 }, (_, i) => i + 1).map(s => (
            <option key={s} value={s}>Semester {s}</option>
          ))}
        </select>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
        <select
          required
          value={subjectId}
          disabled={!semester || subjectsLoading}
          onChange={e => setSubjectId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] disabled:opacity-50"
        >
          <option value="">
            {subjectsLoading ? 'Loading...' : subjects.length === 0 && semester ? 'No subjects — add one first' : 'Select subject'}
          </option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>
              {s.subject_code} — {s.name}
            </option>
          ))}
        </select>
        {semester && subjects.length === 0 && !subjectsLoading && (
          <p className="text-xs text-amber-700 mt-1">
            No subjects found.{' '}
            <a href="/admin/subjects" className="underline">Add a subject first.</a>
          </p>
        )}
      </div>

      {/* Unit */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
        <select
          required
          value={unitNo}
          onChange={e => setUnitNo(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
        >
          <option value="">Select unit</option>
          <option value="1">Unit 1 — Free (always)</option>
          <option value="2">Unit 2 — Partially free (first {30}%)</option>
          <option value="3">Unit 3 — Paid</option>
          <option value="4">Unit 4 — Paid</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">
          is_free is set automatically by unit number — you cannot override it (Rule F2).
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          type="text"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Unit 1: Introduction to Operating Systems"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
        />
      </div>

      {/* PDF file */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
        <input
          type="file"
          required
          accept="application/pdf"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1E3A5F] file:text-white file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-[#163049]"
        />
        <p className="text-xs text-gray-400 mt-1">
          PDF only. Text is extracted server-side. If text &lt; 100 chars, OCR is flagged.
        </p>
      </div>

      {/* Image PDF toggle */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isImagePdf}
          onChange={e => setIsImagePdf(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#F07B10]"
        />
        <span className="text-sm text-gray-700">
          <span className="font-medium">Image/Scan PDF</span>
          <span className="block text-xs text-gray-400 mt-0.5">
            For scanned mock papers and PYQs — skips OCR warning even if no text is extracted.
          </span>
        </span>
      </label>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={uploading || !file || !subjectId || !unitNo || !title}
        className="w-full rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163049] disabled:opacity-50 transition-colors"
      >
        {uploading ? 'Uploading & extracting text...' : 'Upload Material'}
      </button>

      {/* Result */}
      {result && (
        <div className={`rounded-xl border p-4 space-y-3 ${result.needsOcr ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
          <div className="flex items-center justify-between">
            <p className={`font-medium text-sm ${result.needsOcr ? 'text-amber-900' : 'text-emerald-900'}`}>
              {result.needsOcr ? '⚠ Uploaded — OCR required' : '✓ Uploaded successfully'}
            </p>
            <span className="text-xs text-gray-500">
              {result.isFree ? 'Free unit' : 'Paid unit'}
            </span>
          </div>

          <p className="text-sm text-gray-700">{result.message}</p>

          {result.topics.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Extracted topics:</p>
              <div className="flex flex-wrap gap-1.5">
                {result.topics.map(t => (
                  <span key={t} className="inline-block bg-white border border-gray-200 rounded-full px-2.5 py-0.5 text-xs text-gray-700">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">Material ID: <code className="font-mono">{result.materialId}</code></p>
        </div>
      )}
    </form>
  )
}
