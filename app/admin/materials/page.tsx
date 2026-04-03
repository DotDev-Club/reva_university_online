// Materials list — shows active + archived (Rule F4).
// Archived rows are never deleted, shown with 'Archived' label.
import { supabaseAdmin } from '@/lib/supabase/admin'
import MaterialRow from './MaterialRow'

export default async function MaterialsPage() {
  const { data: materials } = await supabaseAdmin
    .from('materials')
    .select('id, unit_no, title, is_free, is_active, needs_ocr, topics, uploaded_at, subject:subjects(name, subject_code, semester, dept:departments(name))')
    .order('uploaded_at', { ascending: false })

  const active = (materials ?? []).filter(m => m.is_active)
  const archived = (materials ?? []).filter(m => !m.is_active)

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Materials</h1>
        <a
          href="/admin/upload"
          className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#163049] transition-colors"
        >
          Upload New
        </a>
      </div>

      {/* OCR alert */}
      {active.some(m => m.needs_ocr) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-900 text-sm">
            ⚠ {active.filter(m => m.needs_ocr).length} material(s) need OCR review
          </p>
          <p className="text-amber-700 text-xs mt-0.5">
            These materials have insufficient extracted text. AI Q&amp;A will be incomplete.
            Re-upload a text-based PDF or run OCR manually.
          </p>
        </div>
      )}

      {/* Active materials */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-3">Active ({active.length})</h2>
        <MaterialTable materials={active} />
      </section>

      {/* Archived materials — Rule F4: never deleted, always shown */}
      {archived.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-500 mb-3">Archived ({archived.length})</h2>
          <MaterialTable materials={archived} />
        </section>
      )}
    </div>
  )
}

function MaterialTable({ materials }: { materials: any[] }) {
  if (materials.length === 0) {
    return <p className="text-gray-500 text-sm">None.</p>
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Subject</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Unit</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Title</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Access</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">OCR</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Uploaded</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {materials.map(m => {
            const subject = Array.isArray(m.subject) ? m.subject[0] : m.subject
            const dept = subject ? (Array.isArray(subject.dept) ? subject.dept[0] : subject.dept) : null
            return (
              <tr key={m.id} className={!m.is_active ? 'opacity-60 bg-gray-50' : ''}>
                <td className="px-4 py-2">
                  <p className="font-medium text-gray-900 text-xs">{subject?.name}</p>
                  <p className="text-gray-400 text-xs">{dept?.name} · Sem {subject?.semester}</p>
                </td>
                <td className="px-4 py-2 text-gray-600">Unit {m.unit_no}</td>
                <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{m.title}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium ${m.is_free ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {m.is_free ? 'Free' : 'Paid'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {m.needs_ocr ? (
                    <span className="text-xs font-medium text-amber-600">⚠ Needed</span>
                  ) : (
                    <span className="text-xs text-gray-400">OK</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-400 text-xs">
                  {new Date(m.uploaded_at).toLocaleDateString('en-IN')}
                </td>
                <td className="px-4 py-2">
                  <MaterialRow id={m.id} isActive={m.is_active} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
