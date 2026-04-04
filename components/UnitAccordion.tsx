'use client'
// Unit accordion — groups PDFs by unit_no.
// Units expand on click; PDFs load only when selected.

import { useState } from 'react'
import dynamic from 'next/dynamic'

const MaterialViewer = dynamic(() => import('./MaterialViewer'), { ssr: false })

interface Material {
  id: string
  unit_no: number
  title: string
  topics: string[]
  is_free: boolean
  needs_ocr: boolean
  access: { allowed: boolean; reason?: string }
}

interface Props {
  units: { unit_no: number; materials: Material[] }[]
  isEarlyUser: boolean
  subscriptionSemester: number | null
  freeUnit2Pct: string | number
  watermark?: string
}

export default function UnitAccordion({ units, isEarlyUser, subscriptionSemester, freeUnit2Pct, watermark }: Props) {
  const [openUnit, setOpenUnit] = useState<number | null>(null)
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null)

  function toggleUnit(unit_no: number) {
    if (openUnit === unit_no) {
      setOpenUnit(null)
      setActiveMaterialId(null)
    } else {
      setOpenUnit(unit_no)
      setActiveMaterialId(null)
    }
  }

  function selectMaterial(id: string) {
    setActiveMaterialId(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-3">
      {units.map(({ unit_no, materials }) => {
        const isOpen = openUnit === unit_no
        const anyAllowed = materials.some(m => m.access.allowed)
        const allLocked = materials.every(m => !m.access.allowed)
        const lockReason = materials[0]?.access.reason

        return (
          <div key={unit_no} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {/* Unit header — always visible, click to expand */}
            <button
              onClick={() => toggleUnit(unit_no)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: allLocked ? '#9CA3AF' : 'var(--reva-teal)' }}>
                  {unit_no}
                </span>
                <div>
                  <p className="text-xs font-medium text-gray-400">Unit {unit_no}</p>
                  <p className="font-semibold text-sm text-gray-900">
                    {materials.length === 1 ? materials[0].title : `${materials.length} materials`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {allLocked ? (
                  <span className="text-xs text-gray-400">🔒 Locked</span>
                ) : (
                  <span className="text-xs font-medium" style={{ color: 'var(--reva-teal)' }}>
                    {unit_no === 1 ? 'Free' : 'Unlocked'}
                  </span>
                )}
                <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Expanded: list of PDFs in this unit */}
            {isOpen && (
              <div className="border-t border-gray-100">
                {allLocked ? (
                  <div className="px-5 py-5 text-center">
                    <p className="text-sm text-gray-500">
                      {lockReason === 'EXPIRED'
                        ? 'Your subscription has expired.'
                        : lockReason === 'WRONG_SEMESTER'
                        ? `Your subscription covers a different semester.`
                        : 'Upgrade to access this unit.'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {materials.map(mat => (
                      <div key={mat.id}>
                        {/* PDF row */}
                        <button
                          onClick={() => mat.access.allowed && selectMaterial(mat.id)}
                          disabled={!mat.access.allowed}
                          className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${
                            mat.access.allowed
                              ? activeMaterialId === mat.id
                                ? 'bg-teal-50'
                                : 'hover:bg-gray-50 cursor-pointer'
                              : 'opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-base">📄</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{mat.title}</p>
                              {mat.topics.length > 0 && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {mat.topics.slice(0, 3).join(' · ')}
                                  {mat.topics.length > 3 && ` +${mat.topics.length - 3} more`}
                                </p>
                              )}
                              {mat.needs_ocr && (
                                <p className="text-xs text-amber-500 mt-0.5">⚠ Scanned PDF — search unavailable</p>
                              )}
                            </div>
                          </div>
                          {mat.access.allowed && (
                            <span className="text-xs text-gray-400 shrink-0">
                              {activeMaterialId === mat.id ? 'Close ▲' : 'View ▶'}
                            </span>
                          )}
                        </button>

                        {/* PDF viewer — only mounts when this PDF is selected */}
                        {activeMaterialId === mat.id && mat.access.allowed && (
                          <div className="border-t border-gray-100">
                            <MaterialViewer
                              materialId={mat.id}
                              unitNo={mat.unit_no}
                              isFreeUnit2={mat.unit_no === 2 && mat.is_free && !isEarlyUser}
                              freeUnit2Pct={freeUnit2Pct}
                              needsOcr={mat.needs_ocr}
                              watermark={watermark}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
