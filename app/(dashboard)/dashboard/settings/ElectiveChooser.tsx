'use client'
// Student elective selection — one radio per elective group.

import { useState, useTransition } from 'react'

interface Subject { id: string; name: string; subject_code: string; course_type: string }

interface Props {
  schemeId: string
  electiveGroups: Record<string, Subject[]>
  chosenElectives: Record<string, string> // group → subject_id
}

export default function ElectiveChooser({ schemeId, electiveGroups, chosenElectives }: Props) {
  const [chosen, setChosen] = useState<Record<string, string>>(chosenElectives)
  const [saving, setSaving] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()

  async function handleSelect(group: string, subjectId: string) {
    if (saving) return
    setSaving(group)
    setErrors(prev => ({ ...prev, [group]: '' }))
    setSaved(prev => ({ ...prev, [group]: false }))

    const res = await fetch('/api/user/elective-choice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemeId, electiveGroup: group, subjectId }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErrors(prev => ({ ...prev, [group]: data.message ?? 'Failed to save.' }))
    } else {
      startTransition(() => {
        setChosen(prev => ({ ...prev, [group]: subjectId }))
        setSaved(prev => ({ ...prev, [group]: true }))
      })
    }
    setSaving(null)
  }

  return (
    <div className="space-y-5">
      {Object.entries(electiveGroups).map(([group, options]) => (
        <div key={group}>
          <p className="text-sm font-medium text-gray-700 mb-2">
            {group}
            {chosen[group] && saved[group] && (
              <span className="ml-2 text-xs text-emerald-600">✓ Saved</span>
            )}
            {!chosen[group] && (
              <span className="ml-2 text-xs text-amber-600">Not chosen yet</span>
            )}
          </p>
          <div className="space-y-2">
            {options.map(sub => (
              <label
                key={sub.id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-all ${
                  chosen[group] === sub.id
                    ? 'border-[#F07B10] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name={group}
                  value={sub.id}
                  checked={chosen[group] === sub.id}
                  onChange={() => handleSelect(group, sub.id)}
                  disabled={saving === group}
                  className="accent-[#F07B10]"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{sub.name}</p>
                  <p className="text-xs font-mono text-gray-400">{sub.subject_code}</p>
                </div>
                {saving === group && chosen[group] !== sub.id && (
                  <span className="text-xs text-gray-400">…</span>
                )}
              </label>
            ))}
          </div>
          {errors[group] && (
            <p className="text-xs text-red-600 mt-1">{errors[group]}</p>
          )}
        </div>
      ))}
    </div>
  )
}
