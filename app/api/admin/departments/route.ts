// PATCH /api/admin/departments — toggle is_active on a department
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function requireAdmin(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const role = user.app_metadata?.role ?? user.user_metadata?.role
  return role === 'admin' ? user : null
}

export async function PATCH(request: NextRequest) {
  const user = await requireAdmin(request)
  if (!user) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  let body: { id: string; isActive: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid body' }, { status: 400 })
  }

  const { id, isActive } = body
  if (!id || typeof isActive !== 'boolean') {
    return NextResponse.json({ message: 'id and isActive required.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('departments')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
