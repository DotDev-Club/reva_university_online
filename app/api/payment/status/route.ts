// GET /api/payment/status
// Client polls this after Razorpay modal closes to confirm subscription activation.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { data, error: userError } = await supabaseAdmin
    .from('users')
    .select('subscription_semester, subscription_expires_at, is_early_user')
    .eq('id', user.id)
    .single()

  if (userError || !data) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 })
  }

  const isActive =
    data.is_early_user ||
    (data.subscription_expires_at !== null &&
      new Date(data.subscription_expires_at) > new Date())

  return NextResponse.json({
    active: isActive,
    semester: data.subscription_semester,
    expiresAt: data.subscription_expires_at,
    isEarlyUser: data.is_early_user,
  })
}
