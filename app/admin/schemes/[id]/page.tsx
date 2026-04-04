// Admin — Scheme detail: view and manage scheme_subjects
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function SchemeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: scheme } = await supabaseAdmin
    .from('schemes')
    .select('id, name, batch_start, batch_end, dept:departments(id, name)')
    .eq('id', id)
    .single()

  if (!scheme) notFound()

  const { data: schemeSubjects } = await supabaseAdmin
    .from('scheme_subjects')
    .select('id, semester, course_type, is_elective, elective_group, is_active, subject:subjects(id, name, subject_code)')
    .eq('scheme_id', id)
    .order('semester')
    .order('course_type')

  // Group by semester
  const bySemester: Record<number, typeof schemeSubjects> = {}
  for (const ss of schemeSubjects ?? []) {
    if (!bySemester[ss.semester]) bySemester[ss.semester] = []
    bySemester[ss.semester]!.push(ss)
  }

  const dept = Array.isArray(scheme.dept) ? scheme.dept[0] : scheme.dept as any

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/schemes" className="text-xs text-gray-400 hover:text-gray-700">← Back to Schemes</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{scheme.name}</h1>
          <p className="text-sm text-gray-500">{dept?.name} · {scheme.batch_start}–{scheme.batch_end} batch</p>
        </div>
      </div>

      {/* Subjects by semester */}
      {Object.keys(bySemester).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">No subjects in this scheme yet.</p>
          <p className="text-xs text-gray-400 mt-1">Import a handbook to populate this scheme.</p>
        </div>
      ) : (
        Object.entries(bySemester)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([sem, rows]) => (
            <section key={sem}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Semester {sem}
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {rows!.map((ss, i) => {
                  const subject = Array.isArray(ss.subject) ? ss.subject[0] : ss.subject as any
                  return (
                    <div
                      key={ss.id}
                      className={`flex items-center justify-between px-5 py-3 ${i > 0 ? 'border-t border-gray-100' : ''} ${!ss.is_active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded font-semibold ${
                          ss.course_type === 'HC' ? 'bg-blue-100 text-blue-700' :
                          ss.course_type === 'SC' ? 'bg-purple-100 text-purple-700' :
                          ss.course_type === 'DC' ? 'bg-gray-100 text-gray-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {ss.course_type}
                        </span>
                        {ss.elective_group && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                            {ss.elective_group}
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{subject?.name}</p>
                          <p className="text-xs font-mono text-gray-400">{subject?.subject_code}</p>
                        </div>
                      </div>
                      {!ss.is_active && (
                        <span className="text-xs text-gray-400">inactive</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))
      )}

      <p className="text-xs text-gray-400">
        To add or modify subjects, re-import a corrected handbook for this scheme. Existing mappings are preserved on conflict.
      </p>
    </div>
  )
}
