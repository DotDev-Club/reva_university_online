import { supabaseAdmin } from '@/lib/supabase/admin'
import AddSubjectForm from './AddSubjectForm'

export default async function SubjectsPage() {
  const [{ data: departments }, { data: subjects }] = await Promise.all([
    supabaseAdmin.from('departments').select('id, name, full_name').order('name'),
    supabaseAdmin
      .from('subjects')
      .select('id, name, subject_code, semester, is_active, dept:departments(name)')
      .order('semester')
      .order('subject_code'),
  ])

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>

      {/* Add subject form */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Add Subject</h2>
        <AddSubjectForm departments={departments ?? []} />
      </section>

      {/* Existing subjects */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">All Subjects</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Code</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Dept</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Sem</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(subjects ?? []).map(s => {
                const dept = Array.isArray(s.dept) ? s.dept[0] : s.dept
                return (
                  <tr key={s.id} className={!s.is_active ? 'opacity-50' : ''}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">{s.subject_code}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-2 text-gray-500">{(dept as any)?.name}</td>
                    <td className="px-4 py-2 text-gray-500">{s.semester}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs ${s.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {(subjects ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500 text-sm">
                    No subjects yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
