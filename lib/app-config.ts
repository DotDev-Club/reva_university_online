// Read typed values from app_config table.
// Always use this — never hardcode config values.
import { supabaseAdmin } from '@/lib/supabase/admin'

async function getConfigValue(key: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('app_config')
    .select('value')
    .eq('key', key)
    .single()

  if (error || !data) {
    throw new Error(`app_config key "${key}" not found: ${error?.message}`)
  }
  return data.value
}

export async function getConfig(key: 'early_user_cap'): Promise<number>
export async function getConfig(key: 'early_user_count'): Promise<number>
export async function getConfig(key: 'subscription_price_inr'): Promise<number>
export async function getConfig(key: 'subscription_duration_months'): Promise<number>
export async function getConfig(key: 'semester_auto_bump_months'): Promise<number>
export async function getConfig(key: 'mock_paper_release_hours'): Promise<number>
export async function getConfig(key: 'free_unit2_page_pct'): Promise<number>
export async function getConfig(key: 'qa_daily_limit'): Promise<number>
export async function getConfig(key: 'claude_model'): Promise<string>
export async function getConfig(key: string): Promise<number | string> {
  const value = await getConfigValue(key)
  const numericKeys = [
    'early_user_cap',
    'early_user_count',
    'subscription_price_inr',
    'subscription_duration_months',
    'semester_auto_bump_months',
    'mock_paper_release_hours',
    'free_unit2_page_pct',
    'qa_daily_limit',
  ]
  return numericKeys.includes(key) ? Number(value) : value
}
