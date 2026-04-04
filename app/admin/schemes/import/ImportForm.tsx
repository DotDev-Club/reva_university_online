'use client'
// Handbook import wizard — uses Claude.ai (no API key required).
// Step 1: Dept + batch → generates a prompt to copy
// Step 2: Admin pastes the JSON output from Claude.ai
// Step 3: Admin reviews and unchecks wrong subjects
// Step 4: Saved to DB

import { useState } from 'react'

interface Department { id: string; name: string; full_name: string }

interface ExtractedSubject {
  subject_code: string
  name: string
  semester: number
  course_type: 'HC' | 'SC' | 'OE' | 'POE' | 'DC'
  elective_group: string | null
  credits: number
  _checked: boolean
}

export default function ImportForm({ departments }: { departments: Department[] }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [deptId, setDeptId] = useState('')
  const [batchStart, setBatchStart] = useState('')
  const [batchEnd, setBatchEnd] = useState('')
  const [pastedJson, setPastedJson] = useState('')
  const [coreSubjects, setCoreSubjects] = useState<ExtractedSubject[]>([])
  const [electiveGroups, setElectiveGroups] = useState<Record<string, ExtractedSubject[]>>({})
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ schemeName: string; subjectsUpserted: number; mappingsCreated: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedDept = departments.find(d => d.id === deptId)

  const claudePrompt = `I have uploaded a Reva University academic handbook PDF. Extract ALL courses/subjects from the semester-wise tables in this handbook.

Return ONLY a valid JSON array — no explanation, no markdown, no code fences. Just the raw JSON array.

Each course must be an object like this:
{
  "subject_code": "B22EF0601",
  "name": "Advanced Java Programming",
  "semester": 6,
  "course_type": "HC",
  "elective_group": null,
  "credits": 4
}

Rules:
- subject_code: exact code from the table (starts with B, e.g. B22EF0601)
- name: full course name as printed
- semester: read from the section heading (SEMESTER VI = 6, III SEMESTER = 3, etc.)
- course_type: read from the HC/SC/OE/POE/DC column — NEVER guess from the code
  - HC = Hard Core (mandatory)
  - SC = Special Course / Professional Elective
  - OE = Open Elective
  - POE = Professional Open Elective
  - DC = Discipline Core
- elective_group: for SC use "PE-1", "PE-2" etc by slot order; for OE/POE use "OE-1", "OE-2" etc; for HC/DC use null
- credits: the number in the credits column

Include everything — HC, SC, OE, POE, DC, labs, mini-projects — as long as it has a course code.`

  function handleCopyPrompt() {
    navigator.clipboard.writeText(claudePrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleParseJson() {
    setError(null)
    let parsed: ExtractedSubject[]
    try {
      const clean = pastedJson.trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
      parsed = JSON.parse(clean)
      if (!Array.isArray(parsed)) throw new Error('Not an array')
    } catch {
      setError('Invalid JSON — make sure you copied the full response from Claude.')
      return
    }

    const valid = parsed.filter(s => s.subject_code && s.name && s.semester)
    if (valid.length === 0) {
      setError('No valid subjects found in the pasted JSON. Check that Claude returned the right format.')
      return
    }

    const withChecked = valid.map(s => ({ ...s, _checked: true }))
    const core: ExtractedSubject[] = []
    const electives: Record<string, ExtractedSubject[]> = {}

    for (const s of withChecked) {
      if (s.elective_group) {
        if (!electives[s.elective_group]) electives[s.elective_group] = []
        electives[s.elective_group].push(s)
      } else {
        core.push(s)
      }
    }

    setCoreSubjects(core)
    setElectiveGroups(electives)
    setStep(3)
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)

    const confirmedSubjects = [
      ...coreSubjects.filter(s => s._checked),
      ...Object.values(electiveGroups).flatMap(subs => subs.filter(s => s._checked)),
    ].map(({ _checked, ...s }) => s)

    const res = await fetch('/api/admin/import-handbook/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deptId, batchStart: Number(batchStart), batchEnd: Number(batchEnd), subjects: confirmedSubjects }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.message ?? 'Save failed.')
      setSaving(false)
      return
    }

    setSaveResult(data)
    setSaving(false)
    setStep(4)
  }

  function toggleCore(code: string) {
    setCoreSubjects(prev => prev.map(s => s.subject_code === code ? { ...s, _checked: !s._checked } : s))
  }

  function toggleElective(group: string, code: string) {
    setElectiveGroups(prev => ({
      ...prev,
      [group]: prev[group].map(s => s.subject_code === code ? { ...s, _checked: !s._checked } : s),
    }))
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]'
  const totalExtracted = coreSubjects.length + Object.values(electiveGroups).reduce((n, g) => n + g.length, 0)
  const stepLabel = ['', 'Setup', 'Paste JSON', 'Review', 'Done']

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${step === n ? 'bg-[#1E3A5F] text-white' : step > n ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step > n ? '✓' : n}
            </span>
            <span className={step === n ? 'text-gray-900 font-medium' : ''}>{stepLabel[n]}</span>
            {n < 4 && <span className="text-gray-300">→</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Dept + batch */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department / Branch</label>
            <select required value={deptId} onChange={e => setDeptId(e.target.value)} className={inputCls}>
              <option value="">Select department</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} — {d.full_name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Start Year</label>
              <input type="number" min={2018} max={2030} placeholder="e.g. 2023"
                value={batchStart} onChange={e => setBatchStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch End Year</label>
              <input type="number" min={2018} max={2034} placeholder="e.g. 2027"
                value={batchEnd} onChange={e => setBatchEnd(e.target.value)} className={inputCls} />
            </div>
          </div>

          <button
            disabled={!deptId || !batchStart || !batchEnd}
            onClick={() => setStep(2)}
            className="w-full rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163049] disabled:opacity-50 transition-colors">
            Continue →
          </button>
        </div>
      )}

      {/* Step 2: Instructions + paste */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-800">How to extract subjects using Claude.ai</p>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Copy the prompt below</li>
              <li>Open <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-[#1E3A5F] underline font-medium">claude.ai</a> and start a new chat</li>
              <li>Upload the {selectedDept?.name} handbook PDF</li>
              <li>Paste the prompt and send</li>
              <li>Copy the JSON array Claude returns and paste it below</li>
            </ol>

            <div className="relative">
              <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-48 text-gray-600 whitespace-pre-wrap">{claudePrompt}</pre>
              <button
                onClick={handleCopyPrompt}
                className="absolute top-2 right-2 rounded-md bg-white border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <label className="block text-sm font-semibold text-gray-800">
              Paste Claude&apos;s JSON output here
            </label>
            <textarea
              rows={10}
              value={pastedJson}
              onChange={e => setPastedJson(e.target.value)}
              placeholder={'[\n  {\n    "subject_code": "B23EF0601",\n    "name": "Advanced Java Programming",\n    "semester": 6,\n    "course_type": "HC",\n    "elective_group": null,\n    "credits": 4\n  },\n  ...\n]'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ← Back
              </button>
              <button
                onClick={handleParseJson}
                disabled={!pastedJson.trim()}
                className="flex-1 rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163049] disabled:opacity-50 transition-colors">
                Parse & Review →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <strong>{totalExtracted} subjects extracted.</strong> Uncheck any that don&apos;t apply to this branch/batch before confirming.
          </div>

          {/* Core subjects */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">Hard Core & Core Subjects (HC / DC)</p>
              <p className="text-xs text-gray-400">Mandatory for all students. Uncheck any that are incorrect.</p>
            </div>
            <div className="divide-y divide-gray-100">
              {coreSubjects.length === 0 && (
                <p className="px-5 py-4 text-sm text-gray-400">No core subjects extracted.</p>
              )}
              {[...coreSubjects].sort((a, b) => a.semester - b.semester || a.subject_code.localeCompare(b.subject_code)).map(s => (
                <label key={s.subject_code} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={s._checked} onChange={() => toggleCore(s.subject_code)}
                    className="h-4 w-4 rounded border-gray-300 accent-[#1E3A5F]" />
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">Sem {s.semester}</span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${s.course_type === 'HC' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{s.course_type}</span>
                  <span className="text-sm font-medium text-gray-900 flex-1">{s.name}</span>
                  <span className="text-xs font-mono text-gray-400">{s.subject_code}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Elective groups */}
          {Object.entries(electiveGroups).map(([group, subs]) => (
            <div key={group} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-amber-50">
                <p className="text-sm font-semibold text-gray-700">Elective Group: {group}</p>
                <p className="text-xs text-gray-500">Students pick one from this group. Uncheck options NOT available for this branch.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {subs.map(s => (
                  <label key={s.subject_code} className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={s._checked} onChange={() => toggleElective(group, s.subject_code)}
                      className="h-4 w-4 rounded border-gray-300 accent-[#F07B10]" />
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">Sem {s.semester}</span>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{s.course_type}</span>
                    <span className="text-sm font-medium text-gray-900 flex-1">{s.name}</span>
                    <span className="text-xs font-mono text-gray-400">{s.subject_code}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              ← Back
            </button>
            <button onClick={handleConfirm} disabled={saving}
              className="flex-1 rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#163049] disabled:opacity-50">
              {saving ? 'Saving…' : 'Confirm & Save →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && saveResult && (
        <div className="bg-white rounded-xl border border-emerald-300 p-8 text-center space-y-3">
          <div className="text-3xl">✅</div>
          <p className="font-bold text-gray-900">{saveResult.schemeName}</p>
          <p className="text-sm text-gray-600">
            {saveResult.subjectsUpserted} subjects saved · {saveResult.mappingsCreated} semester mappings created
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <a href="/admin/schemes" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              View Schemes
            </a>
            <button onClick={() => { setStep(1); setPastedJson(''); setBatchStart(''); setBatchEnd(''); setSaveResult(null) }}
              className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#163049]">
              Import Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
