import { supabaseAdmin } from '@/lib/supabase/admin'
import AddMockPaperForm from './AddMockPaperForm'

export default async function MockPapersPage() {
  const [{ data: departments }, { data: mockPapers }] = await Promise.all([
    supabaseAdmin.from('departments').select('id, name').order('name'),
    supabaseAdmin
      .from('mock_papers')
      .select('id, exam_date, release_at, released, created_at, subject:subjects(name, subject_code, semester, dept:departments(name))')
      .order('exam_date', { ascending: false })
      .limit(20),
  ])

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Mock Papers</h1>

      {/* Add form */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Add Mock Paper</h2>
        <p className="text-xs text-gray-500 mb-4">
          Release time is computed automatically from exam date minus app_config: mock_paper_release_hours (default 24h).
          A cron job handles the actual release — no manual step needed.
        </p>
        <AddMockPaperForm departments={departments ?? []} />
      </section>

      {/* Existing mock papers */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">Recent Mock Papers</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Subject</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Exam Date</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Release At</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(mockPapers ?? []).map(p => {
                const subject = Array.isArray(p.subject) ? p.subject[0] : p.subject
                const dept = subject ? (Array.isArray(subject.dept) ? subject.dept[0] : subject.dept) : null
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2">
                      <p className="font-medium text-gray-900 text-xs">{subject?.name}</p>
                      <p className="text-gray-400 text-xs">{dept?.name} · Sem {subject?.semester}</p>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {new Date(p.exam_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {new Date(p.release_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.released ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.released ? 'Released' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {(mockPapers ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500 text-sm">
                    No mock papers yet.
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
