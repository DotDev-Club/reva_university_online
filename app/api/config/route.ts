// GET /api/config
// Returns safe (non-secret) app_config values for the client.
// Price, limits, etc. — never keys or secrets.
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const SAFE_CONFIG_KEYS = [
  'subscription_price_inr',
  'free_unit2_page_pct',
  'qa_daily_limit',
  'early_user_cap',
] as const

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('app_config')
    .select('key, value')
    .in('key', SAFE_CONFIG_KEYS as unknown as string[])

  if (error) {
    return NextResponse.json({ message: 'Failed to load config' }, { status: 500 })
  }

  const config = Object.fromEntries(data.map(row => [row.key, row.value]))
  return NextResponse.json(config)
}
