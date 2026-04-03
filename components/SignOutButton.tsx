'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
      style={{ color: 'var(--reva-muted)' }}
    >
      Sign out
    </button>
  )
}
