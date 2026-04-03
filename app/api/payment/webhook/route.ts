// POST /api/payment/webhook
// Razorpay calls this on payment.captured / payment.failed / order.paid.
// This is the ONLY place subscriptions are activated.
// Must be idempotent — Razorpay retries for 24 hours (Rule B5).
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getConfig } from '@/lib/app-config'

// Must use Node.js runtime for crypto + raw body access (Appendix P §8)
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Step 1: Read raw body BEFORE any JSON parsing (HMAC needs raw bytes)
  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  // Step 2: Verify webhook signature — MUST be first (Appendix P §4.2)
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex')

  if (expectedSig !== signature) {
    console.warn('Razorpay webhook: invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const payment = event.payload.payment.entity
      const razorpayOrderId: string = payment.order_id
      const razorpayPaymentId: string = payment.id

      // Idempotency check — if already processed, return 200 silently (Rule B5)
      const { data: existing } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('razorpay_payment_id', razorpayPaymentId)
        .single()

      if (existing) {
        console.log(`Webhook duplicate for payment ${razorpayPaymentId} — ignoring`)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Fetch the order row — contains semester captured at order creation time
      // NEVER re-read from users.semester_current (user may have changed it)
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, user_id, semester, amount_paise')
        .eq('razorpay_order_id', razorpayOrderId)
        .single()

      if (!order) {
        console.error(`Webhook: order not found for razorpay_order_id=${razorpayOrderId}`)
        // Return 200 to prevent Razorpay from retrying for a missing order
        return NextResponse.json({ received: true }, { status: 200 })
      }

      const { user_id, semester } = order

      // Compute payment signature for storage (different from webhook sig)
      const paymentSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex')

      // Write payment row — UNIQUE on razorpay_payment_id prevents duplicate writes (Rule B5)
      const { error: paymentError } = await supabaseAdmin.from('payments').insert({
        order_id: order.id,
        user_id,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        razorpay_signature: paymentSig,
        amount_paise: payment.amount,
        method: payment.method ?? 'upi',
        status: 'captured',
      })

      // 23505 = unique_violation = duplicate insert = already processed
      if (paymentError && paymentError.code !== '23505') {
        console.error('Failed to insert payment row:', paymentError)
        throw paymentError
      }

      // Activate subscription only on first (non-duplicate) insert
      if (!paymentError) {
        const durationMonths = await getConfig('subscription_duration_months')
        // months → milliseconds using 30.44 avg days/month
        const expiresAt = new Date(Date.now() + durationMonths * 30.44 * 86400000)

        // Write subscription_semester from ORDER row — never from user row (Appendix P §3.1 critical note)
        // DB trigger will reject if subscription_semester is already set (Rule B2)
        const { error: subError } = await supabaseAdmin
          .from('users')
          .update({
            subscription_semester: semester,
            subscription_expires_at: expiresAt.toISOString(),
          })
          .eq('id', user_id)

        if (subError) {
          console.error('Failed to activate subscription:', subError)
          // Don't throw — payment row written, subscription will need manual fix
        }

        // Update order status
        await supabaseAdmin
          .from('orders')
          .update({ status: 'paid' })
          .eq('razorpay_order_id', razorpayOrderId)
      }

      // Always return 200 — even on duplicate (Appendix P §4.2)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity
      await supabaseAdmin
        .from('orders')
        .update({ status: 'failed' })
        .eq('razorpay_order_id', payment.order_id)

      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Unknown event — return 200 to prevent retries (Appendix P §4.2)
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('Webhook handler error:', err)
    // Still return 200 for non-signature errors to prevent infinite retries
    return NextResponse.json({ received: true }, { status: 200 })
  }
}
