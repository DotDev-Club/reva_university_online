'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MaterialRow({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    await fetch(`/api/admin/materials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        isActive
          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      }`}
    >
      {loading ? '...' : isActive ? 'Archive' : 'Restore'}
    </button>
  )
}
