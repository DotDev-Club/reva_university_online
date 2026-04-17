// Admin — Manage Schemes
import { supabaseAdmin } from '@/lib/supabase/admin'
import Link from 'next/link'

export default async function AdminSchemesPage() {
  const { data: schemes } = await supabaseAdmin
    .from('schemes')
    .select('id, name, batch_start, batch_end, is_active, is_default, dept:departments(name)')
    .order('batch_start', { ascending: false })

  const grouped: Record<string, typeof schemes> = {}
  for (const s of schemes ?? []) {
    const deptName = (Array.isArray(s.dept) ? s.dept[0] : s.dept as any)?.name ?? 'Unknown'
    if (!grouped[deptName]) grouped[deptName] = []
    grouped[deptName]!.push(s)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin" className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors text-gray-700">
            ← Back
          </a>
          <h1 className="text-xl font-bold text-gray-900">Schemes</h1>
        </div>
        <Link href="/admin/schemes/import"
          className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#163049]">
          Import Handbook →
        </Link>
      </div>

      {Object.entries(grouped).map(([dept, deptSchemes]) => (
        <section key={dept}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{dept}</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {deptSchemes!.map((s, i) => {
              const dept = Array.isArray(s.dept) ? s.dept[0] : s.dept as any
              return (
                <div key={s.id} className={`flex items-center justify-between px-5 py-3.5 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900">{s.name}</p>
                      {s.is_default && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">legacy</span>
                      )}
                      {!s.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{s.batch_start}–{s.batch_end} batch</p>
                  </div>
                  <Link href={`/admin/schemes/${s.id}`}
                    className="text-xs text-[#1E3A5F] hover:underline font-medium">
                    Manage subjects →
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {(!schemes || schemes.length === 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">No schemes yet.</p>
          <Link href="/admin/schemes/import" className="text-sm text-[#1E3A5F] underline">
            Import a handbook to create your first scheme →
          </Link>
        </div>
      )}
    </div>
  )
}
