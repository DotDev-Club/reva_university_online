// PATCH /api/admin/materials/[id] — archive or restore a material (Rule F4 — soft delete only)
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await requireAdmin(request)
  if (!user) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  let body: { isActive: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid body' }, { status: 400 })
  }

  // Rule F4: never DELETE rows with student access history — soft delete only
  const { error } = await supabaseAdmin
    .from('materials')
    .update({ is_active: body.isActive })
    .eq('id', id)

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
