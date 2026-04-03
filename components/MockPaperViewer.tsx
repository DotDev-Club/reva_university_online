'use client'
// Mock paper PDF viewer — identical lockdown rules as MaterialViewer (Rule A4).
// Fetches a fresh signed URL on mount — never cached client-side (Rule G3).

import { useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export default function MockPaperViewer({ mockPaperId }: { mockPaperId: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUrl() {
      setLoading(true)
      try {
        const res = await fetch(`/api/content/mock-paper/${mockPaperId}`)
        if (!res.ok) {
          const data = await res.json()
          setError(data.message ?? 'Failed to load paper.')
          return
        }
        const { url } = await res.json()
        setSignedUrl(url)
      } catch {
        setError('Failed to load paper. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchUrl()
  }, [mockPaperId])

  if (loading) {
    return <div className="py-12 text-center text-sm text-gray-500 animate-pulse">Loading mock paper...</div>
  }
  if (error) {
    return <div className="py-8 text-center text-sm text-red-600">{error}</div>
  }
  if (!signedUrl) return null

  return (
    <div
      className="overflow-auto max-h-[80vh] rounded-xl border border-gray-200 bg-gray-50 select-none"
      onContextMenu={e => e.preventDefault()}
    >
      <Document
        file={signedUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={() => setError('Failed to render PDF.')}
        className="flex flex-col items-center gap-2 p-2"
      >
        {numPages &&
          Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
            <Page
              key={pageNum}
              pageNumber={pageNum}
              width={Math.min(720, typeof window !== 'undefined' ? window.innerWidth - 64 : 720)}
              renderAnnotationLayer={false}
              renderTextLayer={false}
            />
          ))}
      </Document>
      {numPages && (
        <p className="text-xs text-gray-400 text-center py-2">{numPages} pages</p>
      )}
    </div>
  )
}
