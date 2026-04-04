// GET  /api/admin/schemes       — list all schemes (admin only)
// POST /api/admin/schemes       — create a new scheme (admin only)
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = user.app_metadata?.role ?? user.user_metadata?.role
  return role === 'admin' ? user : null
}

export async function GET() {
  if (!await verifyAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('schemes')
    .select('id, name, batch_start, batch_end, is_active, is_default, dept:departments(name, full_name)')
    .order('batch_start', { ascending: false })

  if (error) return NextResponse.json({ message: 'Failed to fetch schemes' }, { status: 500 })
  return NextResponse.json({ schemes: data ?? [] })
}

export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  let body: { deptId: string; name: string; batchStart: number; batchEnd: number; isDefault?: boolean }
  try { body = await request.json() } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const { deptId, name, batchStart, batchEnd, isDefault } = body
  if (!deptId || !name || !batchStart || !batchEnd) {
    return NextResponse.json({ message: 'deptId, name, batchStart, batchEnd are required.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('schemes')
    .insert({ dept_id: deptId, name, batch_start: batchStart, batch_end: batchEnd, is_default: isDefault ?? false })
    .select('id, name')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ message: 'A scheme for this dept and batch year already exists.' }, { status: 409 })
    return NextResponse.json({ message: 'Failed to create scheme' }, { status: 500 })
  }

  return NextResponse.json({ scheme: data }, { status: 201 })
}
