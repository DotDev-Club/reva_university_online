'use client'
// Fetches a 5-minute signed URL on mount, renders PDF via react-pdf.
// No download button rendered in DOM — not hidden, never rendered (Rule A4).
// For Unit 2 free access: enforces page cutoff client-side (server already gated the URL).

import { useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Required: point to PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  materialId: string
  unitNo: number
  isFreeUnit2: boolean       // true = show only first freeUnit2Pct% of pages
  freeUnit2Pct: number
  needsOcr: boolean
}

export default function MaterialViewer({ materialId, unitNo, isFreeUnit2, freeUnit2Pct, needsOcr }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Request a fresh signed URL on every open — never store in localStorage (Rule G3)
    async function fetchUrl() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/content/material/${materialId}/signed-url`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.message ?? 'Failed to load material.')
          return
        }
        const { url } = await res.json()
        setSignedUrl(url)
      } catch {
        setError('Failed to load material. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchUrl()
  }, [materialId])

  // Max page to render for Unit 2 free users
  const maxPageForFreeUser = (numPages: number) =>
    Math.max(1, Math.floor((numPages * freeUnit2Pct) / 100))

  if (loading) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500 animate-pulse">
        Loading material...
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6 text-center text-sm text-red-600">{error}</div>
    )
  }

  if (!signedUrl) return null

  return (
    <div className="px-4 py-4">
      {needsOcr && (
        <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Note: AI Q&amp;A may be incomplete for this unit — OCR processing pending.
        </div>
      )}

      {/* PDF viewer — no context menu, no selection-to-download triggers */}
      <div
        className="overflow-auto max-h-[70vh] rounded-lg border border-gray-200 bg-gray-50 select-none"
        onContextMenu={e => e.preventDefault()}  // Prevent right-click save-as
      >
        <Document
          file={signedUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setError('Failed to render PDF.')}
          className="flex flex-col items-center gap-2 p-2"
        >
          {numPages &&
            Array.from(
              { length: isFreeUnit2 ? maxPageForFreeUser(numPages) : numPages },
              (_, i) => i + 1
            ).map(pageNum => (
              <Page
                key={pageNum}
                pageNumber={pageNum}
                width={Math.min(680, typeof window !== 'undefined' ? window.innerWidth - 64 : 680)}
                renderAnnotationLayer={false}  // Disable clickable links that could expose URLs
                renderTextLayer={false}        // Disable text selection
              />
            ))}
        </Document>
      </div>

      {/* Unit 2 paywall overlay after free pages */}
      {isFreeUnit2 && numPages && maxPageForFreeUser(numPages) < numPages && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="font-medium text-amber-900 text-sm">
            You&apos;ve reached the free preview limit ({freeUnit2Pct}% of Unit {unitNo})
          </p>
          <p className="text-amber-700 text-xs mt-1">
            Upgrade to access {numPages - maxPageForFreeUser(numPages)} more pages.
          </p>
        </div>
      )}

      {/* Page count — no download/print controls rendered (Rule A4) */}
      {numPages && (
        <p className="text-xs text-gray-400 text-center mt-2">
          {isFreeUnit2
            ? `Showing ${maxPageForFreeUser(numPages)} of ${numPages} pages`
            : `${numPages} pages`}
        </p>
      )}
    </div>
  )
}
