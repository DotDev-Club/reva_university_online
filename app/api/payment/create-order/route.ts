// POST /api/payment/create-order
// Creates a Razorpay order server-side. All pre-checks run here.
// Returns only safe fields to the client (never the secret).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { razorpay } from '@/lib/razorpay'
import { getConfig } from '@/lib/app-config'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user row
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('semester_current, subscription_semester, subscription_expires_at, is_early_user, email_verified')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ message: 'User profile not found' }, { status: 400 })
    }

    // Pre-check: email must be verified (Rule G1)
    if (!userData.email_verified) {
      return NextResponse.json({ message: 'Please verify your email before purchasing.' }, { status: 400 })
    }

    // Pre-check: early users have full access — no purchase needed (Appendix P §4.1)
    if (userData.is_early_user) {
      return NextResponse.json({ message: 'You have free early access — no purchase needed.' }, { status: 400 })
    }

    // Pre-check: no active subscription already (Rule B3)
    if (userData.subscription_expires_at && new Date(userData.subscription_expires_at) > new Date()) {
      const expiresAt = new Date(userData.subscription_expires_at)
      const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)
      return NextResponse.json(
        {
          message: `Your Semester ${userData.subscription_semester} access is active for ${daysRemaining} more days.`,
          daysRemaining,
          subscriptionSemester: userData.subscription_semester,
        },
        { status: 400 }
      )
    }

    // Read price from app_config — never hardcode (Rule B4)
    const priceInr = await getConfig('subscription_price_inr')
    const amountPaise = priceInr * 100

    // Capture semester_current NOW — immutable after order creation (Appendix P §3.1)
    const semester = userData.semester_current

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `recv_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        user_id: user.id,
        semester: String(semester),
      },
    })

    // Write order to DB (semester locked here)
    const { error: orderError } = await supabaseAdmin.from('orders').insert({
      user_id: user.id,
      razorpay_order_id: razorpayOrder.id,
      amount_paise: amountPaise,
      currency: 'INR',
      semester,
      status: 'created',
    })

    if (orderError) {
      console.error('Failed to create order row:', orderError)
      return NextResponse.json({ message: 'Failed to create order' }, { status: 500 })
    }

    // Return only safe fields — NEVER the secret (Appendix P §4.1)
    return NextResponse.json({
      orderId: razorpayOrder.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      semester,
    })
  } catch (err) {
    console.error('create-order error:', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
