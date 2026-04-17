'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Subject { id: string; name: string; subject_code: string }

interface Props {
  schemeId: string
  group: string
  options: Subject[]
  chosenSubjectId?: string
}

export default function ElectiveCard({ schemeId, group, options, chosenSubjectId }: Props) {
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState(chosenSubjectId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleSelect(subjectId: string) {
    if (saving) return
    setSaving(true)
    setError('')
    setSaved(false)

    const res = await fetch('/api/user/elective-choice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemeId, electiveGroup: group, subjectId }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.message ?? 'Failed to save.')
    } else {
      setChosen(subjectId)
      setSaved(true)
      setOpen(false)
      router.refresh()
    }
    setSaving(false)
  }

  const chosenSubject = options.find(o => o.id === chosen)
  const label = group.startsWith('PE') ? 'Professional Elective' : 'Open Elective'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full group bg-white rounded-2xl border-2 border-dashed p-5 hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-2"
        style={{ borderColor: chosen ? 'var(--reva-teal)' : 'var(--reva-orange)' }}
      >
        <span className="text-2xl">{chosen ? '✅' : '🎓'}</span>
        {chosen && chosenSubject ? (
          <>
            <p className="font-semibold text-sm" style={{ color: 'var(--reva-teal)' }}>{group} — {label}</p>
            <p className="text-xs font-medium" style={{ color: 'var(--reva-navy)' }}>{chosenSubject.name}</p>
            <p className="text-xs" style={{ color: 'var(--reva-muted)' }}>Tap to change</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-sm" style={{ color: 'var(--reva-orange)' }}>Choose {group} — {label}</p>
            <p className="text-xs" style={{ color: 'var(--reva-muted)' }}>Tap to pick your elective subject</p>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-20 top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-lg border overflow-hidden"
          style={{ borderColor: 'var(--reva-border)' }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--reva-border)', background: 'var(--reva-bg)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--reva-muted)' }}>
              {group} — {label}
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'var(--reva-border)' }}>
            {options.map(sub => (
              <button
                key={sub.id}
                onClick={() => handleSelect(sub.id)}
                disabled={saving}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{
                    borderColor: chosen === sub.id ? 'var(--reva-orange)' : 'var(--reva-border)',
                    background: chosen === sub.id ? 'var(--reva-orange)' : 'transparent',
                  }}
                >
                  {chosen === sub.id && <span className="w-2 h-2 rounded-full bg-white block" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--reva-navy)' }}>{sub.name}</p>
                  <p className="text-xs font-mono" style={{ color: 'var(--reva-muted)' }}>{sub.subject_code}</p>
                </div>
                {saving && chosen !== sub.id && (
                  <span className="text-xs" style={{ color: 'var(--reva-muted)' }}>…</span>
                )}
              </button>
            ))}
          </div>
          {error && (
            <p className="px-4 py-2 text-xs text-red-600 border-t" style={{ borderColor: 'var(--reva-border)' }}>{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
