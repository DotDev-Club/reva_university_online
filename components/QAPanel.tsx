'use client'
// Claude Q&A panel — stateless sessions, rate-limited server-side (Rules E1–E4).
// No conversation history stored. Each question is a fresh call.

import { useState } from 'react'

interface Props {
  subjectId: string
  subjectName: string
}

interface QAEntry {
  question: string
  answer: string
}

export default function QAPanel({ subjectId, subjectName }: Props) {
  const [question, setQuestion] = useState('')
  const [entries, setEntries] = useState<QAEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || loading) return

    const currentQuestion = question.trim()
    setLoading(true)
    setError(null)
    setQuestion('')

    try {
      const res = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId, question: currentQuestion }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? 'Failed to get answer.')
        setQuestion(currentQuestion) // Restore question on failure
        return
      }

      setEntries(prev => [...prev, { question: currentQuestion, answer: data.answer }])
      if (typeof data.questionsRemaining === 'number') {
        setRemaining(data.questionsRemaining)
      }
    } catch {
      setError('Failed to connect. Please try again.')
      setQuestion(currentQuestion)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Q&A history — displayed in session only, not persisted (Rule E4) */}
      {entries.length > 0 && (
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {entries.map((entry, i) => (
            <div key={i} className="px-4 py-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-[#1E3A5F] shrink-0 mt-0.5">You</span>
                <p className="text-sm text-gray-800">{entry.question}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-emerald-700 shrink-0 mt-0.5">AI</span>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.answer}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleAsk} className="flex items-end gap-2 p-3 border-t border-gray-100">
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleAsk(e as any)
            }
          }}
          placeholder={`Ask anything about ${subjectName}...`}
          rows={2}
          disabled={loading}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#163049] disabled:opacity-50 transition-colors self-end"
        >
          {loading ? '...' : 'Ask'}
        </button>
      </form>

      {remaining !== null && (
        <p className="px-3 pb-2 text-xs text-gray-400">
          {remaining} question{remaining !== 1 ? 's' : ''} remaining today
        </p>
      )}
    </div>
  )
}
