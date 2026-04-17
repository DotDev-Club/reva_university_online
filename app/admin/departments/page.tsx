// Departments — flip is_active after content is ready (change protocol: add dept → upload all → flip true)
import { supabaseAdmin } from '@/lib/supabase/admin'
import DepartmentToggle from './DepartmentToggle'

export default async function DepartmentsPage() {
  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('id, name, full_name, is_active, created_at')
    .order('name')

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/admin" className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors text-gray-700">
          ← Back
        </a>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-500 text-sm mt-0.5">Add all content before flipping a department active — students see it immediately.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Department</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(departments ?? []).map(dept => (
              <tr key={dept.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{dept.name}</p>
                  <p className="text-xs text-gray-500">{dept.full_name}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${dept.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {dept.is_active ? 'Active' : 'Hidden'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <DepartmentToggle id={dept.id} isActive={dept.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Activation checklist</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
          <li>Add all subjects via <a href="/admin/subjects" className="underline">Subjects</a></li>
          <li>Upload all unit PDFs via <a href="/admin/upload" className="underline">Upload Material</a></li>
          <li>Add mock papers via <a href="/admin/mock-papers" className="underline">Mock Papers</a></li>
          <li>Flip department to Active here</li>
        </ol>
      </div>
    </div>
  )
}
