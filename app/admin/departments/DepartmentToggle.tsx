'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DepartmentToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    await fetch('/api/admin/departments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !isActive }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        isActive
          ? 'bg-red-50 text-red-700 hover:bg-red-100'
          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      }`}
    >
      {loading ? '...' : isActive ? 'Deactivate' : 'Activate'}
    </button>
  )
}
