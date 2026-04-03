'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadRazorpay } from '@/utils/loadRazorpay'

interface Props { semester: number; priceInr: number }
type Status = 'idle' | 'opening' | 'processing' | 'success' | 'failed'

export default function BuyAccessButton({ semester, priceInr }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleBuy() {
    setStatus('opening')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/payment/create-order', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.message ?? 'Could not initiate payment.'); setStatus('failed'); return }

      const { orderId, amount, currency, keyId } = data
      const RazorpayConstructor = await loadRazorpay()
      const rzp = new RazorpayConstructor({
        key: keyId, amount, currency, order_id: orderId,
        name: 'revauniversity.online',
        description: `Semester ${semester} Full Access`,
        theme: { color: '#F07B10' },
        handler: async function () {
          setStatus('processing')
          await pollForActivation()
        },
        modal: { ondismiss: () => { if (status !== 'success') setStatus('idle') } },
      })
      rzp.open()
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('failed')
    }
  }

  async function pollForActivation(maxAttempts = 10, intervalMs = 1500) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, intervalMs))
      try {
        const res = await fetch('/api/payment/status')
        const { active } = await res.json()
        if (active) { setStatus('success'); router.refresh(); return }
      } catch { /* ignore transient fetch errors */ }
    }
    setErrorMsg('Payment processing — refresh in a moment.')
    setStatus('failed')
  }

  if (status === 'success') {
    return (
      <span className="shrink-0 text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: 'var(--reva-teal-light)', color: 'var(--reva-teal)' }}>
        ✓ Access activated!
      </span>
    )
  }
  if (status === 'processing') {
    return <span className="text-xs shrink-0" style={{ color: 'var(--reva-muted)' }}>Activating…</span>
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        onClick={handleBuy}
        disabled={status === 'opening'}
        className="btn-reva whitespace-nowrap"
      >
        {status === 'opening' ? 'Opening…' : `Buy — ₹${priceInr}`}
      </button>
      {errorMsg && <p className="text-xs max-w-xs text-right" style={{ color: '#B71C1C' }}>{errorMsg}</p>}
    </div>
  )
}
