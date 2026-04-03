import SignupForm from './SignupForm'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function SignupPage() {
  // Fetch active departments server-side for the dropdown
  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('id, name, full_name')
    .eq('is_active', true)
    .order('name')

  return <SignupForm departments={departments ?? []} />
}
