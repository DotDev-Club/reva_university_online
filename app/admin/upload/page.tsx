import { supabaseAdmin } from '@/lib/supabase/admin'
import UploadForm from './UploadForm'

export default async function UploadPage() {
  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('id, name, full_name, is_active')
    .order('name')

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <a href="/admin" className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors text-gray-700">
          ← Back
        </a>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Material</h1>
          <p className="text-gray-500 text-sm mt-0.5">Department → Semester → Subject → Unit. All levels required (Rule F1).</p>
        </div>
      </div>
      <UploadForm departments={departments ?? []} />
    </div>
  )
}
