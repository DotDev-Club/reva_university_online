// POST /api/admin/import-handbook
// Extracts subjects from a handbook PDF using Claude's native PDF vision.
// Works for both text-based and scanned/image PDFs.
// Returns a preview for admin review — does NOT write to DB.
// Course type (HC/SC/OE/POE/DC) is read from the handbook table columns,
// not inferred from the course code (which varies by batch year and dept).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { PDFDocument } from 'pdf-lib'

export const runtime = 'nodejs'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = user.app_metadata?.role ?? user.user_metadata?.role
  return role === 'admin' ? user : null
}

interface ExtractedSubject {
  subject_code: string
  name: string
  semester: number
  course_type: 'HC' | 'SC' | 'OE' | 'POE' | 'DC'
  elective_group: string | null
  credits: number
}

// Split a PDF buffer into chunks of at most maxPages pages each.
// Returns array of base64-encoded PDF strings.
async function splitPdf(buffer: Buffer, maxPages = 80): Promise<string[]> {
  const src = await PDFDocument.load(buffer)
  const total = src.getPageCount()
  const chunks: string[] = []

  for (let start = 0; start < total; start += maxPages) {
    const end = Math.min(start + maxPages, total)
    const chunk = await PDFDocument.create()
    const pages = await chunk.copyPages(src, Array.from({ length: end - start }, (_, i) => start + i))
    pages.forEach(p => chunk.addPage(p))
    const bytes = await chunk.save()
    chunks.push(Buffer.from(bytes).toString('base64'))
  }

  return chunks
}

export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const batchStart = Number(formData.get('batchStart'))
  const batchEnd = Number(formData.get('batchEnd'))

  if (!file || !batchStart || !batchEnd) {
    return NextResponse.json({ message: 'file, batchStart, and batchEnd are required.' }, { status: 400 })
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  // Split the PDF into ≤80-page chunks so each fits within Claude's limit.
  let pdfChunks: string[]
  try {
    pdfChunks = await splitPdf(fileBuffer)
  } catch (err) {
    console.error('PDF split failed:', err)
    return NextResponse.json({ message: 'Could not read the PDF file. Make sure it is a valid PDF.' }, { status: 422 })
  }

  console.log(`[import-handbook] PDF split into ${pdfChunks.length} chunks`)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const gemini = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `You are extracting course/subject data from a Reva University academic handbook PDF.

The handbook contains tables listing subjects semester-wise. Each row in the table has:
- A subject/course name (e.g. "Advanced Java Programming", "Machine Learning")
- A course code next to the name (format like B22EF0601, B22EFS61X, B22CIT052X — starts with B followed by digits and letters)
- A course type column: HC (Hard Core), SC (Special Course / Professional Elective), OE (Open Elective), POE (Professional Open Elective), DC (Discipline Core)
- Credits (a number, usually 3 or 4)
- The semester is shown as a section heading above the table (e.g. "SEMESTER VI", "III SEMESTER")

Return ONLY a valid JSON array. No explanation, no markdown, no code fences. If there are no course tables visible, return [].

Each extracted course must be:
{
  "subject_code": "exact code from the table, e.g. B22EF0601",
  "name": "full course name as written",
  "semester": 6,
  "course_type": "HC",
  "elective_group": null,
  "credits": 4
}

Rules:
- semester: read from the section heading (SEMESTER VI = 6, III SEMESTER = 3, etc.)
- course_type: read from the HC/SC/OE/POE/DC column — NEVER guess from the course code
- elective_group: for SC courses use "PE-1", "PE-2" etc (by slot order); for OE/POE use "OE-1", "OE-2" etc; for HC/DC set null
- credits: read the number from the credits column
- Include ALL courses visible — HC, SC, OE, POE, DC, labs, mini-projects, everything with a course code

Extract all subjects from this handbook section.`

  const allSubjects: ExtractedSubject[] = []

  // Process chunks sequentially to stay within free-tier rate limits
  for (const base64Pdf of pdfChunks) {
    try {
      const result = await gemini.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Pdf,
          },
        },
      ])
      const text = result.response.text().trim()
      console.log('[import-handbook] Gemini response (first 300 chars):', text.slice(0, 300))
      const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
      const parsed = JSON.parse(clean)
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((s: ExtractedSubject) => s.subject_code && s.name && s.semester)
        console.log('[import-handbook] Subjects from this chunk:', valid.length)
        allSubjects.push(...valid)
      }
    } catch (e) {
      console.warn('[import-handbook] Gemini chunk failed:', e)
    }
  }

  // Deduplicate by (subject_code, semester) — keep last seen
  const seen = new Map<string, ExtractedSubject>()
  for (const s of allSubjects) {
    const key = `${s.subject_code}|${s.semester}`
    seen.set(key, s)
  }
  const subjects = Array.from(seen.values())

  // Group elective options
  const electiveGroups: Record<string, ExtractedSubject[]> = {}
  const coreSubjects: ExtractedSubject[] = []
  for (const s of subjects) {
    if (s.elective_group) {
      if (!electiveGroups[s.elective_group]) electiveGroups[s.elective_group] = []
      electiveGroups[s.elective_group].push(s)
    } else {
      coreSubjects.push(s)
    }
  }

  return NextResponse.json({
    batchStart,
    batchEnd,
    totalExtracted: subjects.length,
    coreSubjects,
    electiveGroups,
  })
}
