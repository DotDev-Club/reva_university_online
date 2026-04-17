'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import UnitAccordion from './UnitAccordion'

const QAPanel = dynamic(() => import('./QAPanel'), { ssr: false })

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
  subjectId: string
  subjectName: string
  isSubscribed: boolean
  allMaterials: Material[]
  initialTab?: Tab
}

const TABS = ['Units', 'Syllabus', 'AI Q&A'] as const
type Tab = typeof TABS[number]

export default function SubjectTabs({
  units, isEarlyUser, subscriptionSemester, freeUnit2Pct,
  watermark, subjectId, subjectName, isSubscribed, allMaterials, initialTab,
}: Props) {
  const [active, setActive] = useState<Tab>(initialTab ?? 'Units')

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 bg-white rounded-xl border p-1" style={{ borderColor: 'var(--reva-border)' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            style={active === tab ? {
              background: 'var(--reva-orange)',
              color: '#fff',
            } : {
              color: 'var(--reva-muted)',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Units tab */}
      {active === 'Units' && (
        <div className="space-y-3">
          {units.length === 0 ? (
            <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--reva-border)' }}>
              <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>No materials uploaded yet.</p>
            </div>
          ) : (
            <UnitAccordion
              units={units}
              isEarlyUser={isEarlyUser}
              subscriptionSemester={subscriptionSemester}
              freeUnit2Pct={freeUnit2Pct}
              watermark={watermark}
            />
          )}
        </div>
      )}

      {/* Syllabus tab */}
      {active === 'Syllabus' && (
        <div className="space-y-4">
          {units.length === 0 ? (
            <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--reva-border)' }}>
              <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>No syllabus data yet.</p>
            </div>
          ) : (
            units.map(({ unit_no, materials }) => {
              const allTopics = materials.flatMap(m => m.topics)
              const locked = materials.every(m => !m.access.allowed)
              return (
                <div key={unit_no} className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--reva-border)' }}>
                  {/* Unit header */}
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b" style={{ borderColor: 'var(--reva-border)', background: locked ? 'var(--reva-bg)' : 'var(--reva-teal-light)' }}>
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: locked ? '#9CA3AF' : 'var(--reva-teal)' }}
                    >
                      {unit_no}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-medium" style={{ color: locked ? 'var(--reva-muted)' : 'var(--reva-teal)' }}>Unit {unit_no}</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--reva-navy)' }}>
                        {materials.length === 1 ? materials[0].title : `${materials.length} materials`}
                      </p>
                    </div>
                    {locked && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--reva-orange-light)', color: 'var(--reva-orange)' }}>
                        🔒 Paid
                      </span>
                    )}
                    {!locked && unit_no === 1 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--reva-teal-light)', color: 'var(--reva-teal)' }}>
                        Free
                      </span>
                    )}
                  </div>
                  {/* Topics */}
                  <div className="px-5 py-4">
                    {allTopics.length > 0 ? (
                      <ul className="space-y-2">
                        {allTopics.map((topic, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: locked ? '#9CA3AF' : 'var(--reva-teal)' }} />
                            <span style={{ color: locked ? 'var(--reva-muted)' : 'var(--reva-text)' }}>{topic}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--reva-muted)' }}>Topics not listed yet.</p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* AI Q&A tab */}
      {active === 'AI Q&A' && (
        <div>
          {isSubscribed ? (
            <QAPanel subjectId={subjectId} subjectName={subjectName} />
          ) : (
            <div className="bg-white rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--reva-border)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4" style={{ background: '#F3E5F5' }}>🤖</div>
              <p className="font-semibold" style={{ color: 'var(--reva-navy)' }}>AI Q&amp;A is a paid feature</p>
              <p className="text-sm mt-1" style={{ color: 'var(--reva-muted)' }}>
                Upgrade to ask unlimited questions about {subjectName}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
