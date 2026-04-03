import { supabaseAdmin } from '@/lib/supabase/admin'
import UploadForm from './UploadForm'

export default async function UploadPage() {
  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('id, name, full_name, is_active')
    .order('name')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Material</h1>
        <p className="text-gray-500 text-sm mt-1">
          Department → Semester → Subject → Unit. All levels required (Rule F1).
        </p>
      </div>
      <UploadForm departments={departments ?? []} />
    </div>
  )
}
