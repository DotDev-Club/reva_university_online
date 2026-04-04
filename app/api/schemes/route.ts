// GET /api/schemes?deptId=<uuid>
// Public endpoint — returns active schemes for a department.
// Used by signup form to populate the admission year dropdown.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const deptId = request.nextUrl.searchParams.get('deptId')
  if (!deptId) {
    return NextResponse.json({ schemes: [] })
  }

  const { data, error } = await supabaseAdmin
    .from('schemes')
    .select('id, name, batch_start, batch_end')
    .eq('dept_id', deptId)
    .eq('is_active', true)
    .eq('is_default', false)   // exclude legacy placeholder schemes from signup
    .order('batch_start', { ascending: false })

  if (error) {
    return NextResponse.json({ schemes: [] })
  }

  return NextResponse.json({ schemes: data ?? [] })
}
