// Admin overview — platform stats at a glance
import { supabaseAdmin } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function AdminOverviewPage() {
  const [
    { count: userCount },
    { count: subjectCount },
    { count: materialCount },
    { count: ocrCount },
    { count: mockPaperCount },
    { data: configRows },
    { data: recentPayments },
  ] = await Promise.all([
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('subjects').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('materials').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('materials').select('*', { count: 'exact', head: true }).eq('needs_ocr', true).eq('is_active', true),
    supabaseAdmin.from('mock_papers').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('app_config').select('key, value').in('key', ['early_user_count', 'early_user_cap', 'subscription_price_inr']),
    supabaseAdmin
      .from('payments')
      .select('id, amount_paise, method, status, created_at, user:users(full_name, email)')
      .eq('status', 'captured')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const config = Object.fromEntries((configRows ?? []).map(r => [r.key, r.value]))
  const earlyUserCount = Number(config.early_user_count ?? 0)
  const earlyUserCap = Number(config.early_user_cap ?? 150)
  const priceInr = Number(config.subscription_price_inr ?? 159)

  const stats = [
    { label: 'Total Users', value: userCount ?? 0, href: null },
    { label: 'Early Users', value: `${earlyUserCount} / ${earlyUserCap}`, href: null },
    { label: 'Active Subjects', value: subjectCount ?? 0, href: '/admin/subjects' },
    { label: 'Active Materials', value: materialCount ?? 0, href: '/admin/materials' },
    { label: 'Needs OCR', value: ocrCount ?? 0, href: '/admin/materials', alert: (ocrCount ?? 0) > 0 },
    { label: 'Mock Papers', value: mockPaperCount ?? 0, href: '/admin/mock-papers' },
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map(stat => (
          <div
            key={stat.label}
            className={`bg-white rounded-xl border p-4 ${stat.alert ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}
          >
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.alert ? 'text-amber-700' : 'text-gray-900'}`}>
              {stat.value}
            </p>
            {stat.href && (
              <Link href={stat.href} className="text-xs text-[#1E3A5F] hover:underline mt-1 inline-block">
                View →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Recent payments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Payments</h2>
          <p className="text-xs text-gray-500">₹{priceInr} / semester</p>
        </div>
        {!recentPayments || recentPayments.length === 0 ? (
          <p className="text-gray-500 text-sm">No payments yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Student</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Amount</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Method</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentPayments.map(p => {
                  const student = Array.isArray(p.user) ? p.user[0] : p.user
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-2">
                        <p className="font-medium text-gray-900">{(student as any)?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-500">{(student as any)?.email ?? '—'}</p>
                      </td>
                      <td className="px-4 py-2 text-gray-900">₹{p.amount_paise / 100}</td>
                      <td className="px-4 py-2 text-gray-500 uppercase text-xs">{p.method}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {new Date(p.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/admin/upload', label: 'Upload Material', icon: '📤' },
          { href: '/admin/departments', label: 'Manage Depts', icon: '🏛' },
          { href: '/admin/subjects', label: 'Add Subject', icon: '📚' },
          { href: '/admin/mock-papers', label: 'Add Mock Paper', icon: '📝' },
        ].map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-4 hover:border-[#1E3A5F] hover:shadow-sm transition-all text-center"
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
