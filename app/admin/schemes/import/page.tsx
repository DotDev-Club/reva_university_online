// Admin — Handbook import wizard
import { supabaseAdmin } from '@/lib/supabase/admin'
import ImportForm from './ImportForm'

export default async function ImportHandbookPage() {
  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('id, name, full_name')
    .order('name')

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Import Handbook</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a branch handbook PDF. Claude extracts all subjects — you review and confirm before anything is saved.
        </p>
      </div>
      <ImportForm departments={departments ?? []} />
    </div>
  )
}
