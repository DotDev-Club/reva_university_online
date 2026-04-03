// POST /api/admin/upload
// Admin-only route for uploading material PDFs.
// Handles: storage upload → text extraction → OCR fallback → Claude topic extraction → DB write.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'
import { getConfig } from '@/lib/app-config'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Verify admin role (G2 — checked on every request via middleware too)
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const role = user.app_metadata?.role ?? user.user_metadata?.role
  if (role !== 'admin') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  // Parse multipart form data
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const subjectId = formData.get('subjectId') as string | null
  const unitNo = Number(formData.get('unitNo'))
  const title = formData.get('title') as string | null

  if (!file || !subjectId || !unitNo || !title) {
    return NextResponse.json({ message: 'file, subjectId, unitNo, and title are required' }, { status: 400 })
  }

  if (![1, 2, 3, 4].includes(unitNo)) {
    return NextResponse.json({ message: 'unitNo must be 1, 2, 3, or 4' }, { status: 400 })
  }

  // Verify subject exists and is not a duplicate subject_code check (F3 handled at subjects level)
  const { data: subject, error: subjectError } = await supabaseAdmin
    .from('subjects')
    .select('id, semester, dept_id')
    .eq('id', subjectId)
    .single()

  if (subjectError || !subject) {
    return NextResponse.json({ message: 'Subject not found' }, { status: 404 })
  }

  // Soft-archive any existing active material for this subject+unit (Rule F4 — no hard deletes)
  await supabaseAdmin
    .from('materials')
    .update({ is_active: false })
    .eq('subject_id', subjectId)
    .eq('unit_no', unitNo)
    .eq('is_active', true)

  // Upload PDF to Supabase Storage
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${subject.dept_id}/${subject.semester}/${subjectId}/unit${unitNo}_${Date.now()}.pdf`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('materials')
    .upload(storagePath, fileBuffer, { contentType: 'application/pdf' })

  if (uploadError) {
    console.error('Storage upload failed:', uploadError)
    return NextResponse.json({ message: 'Failed to upload file' }, { status: 500 })
  }

  // Extract text from PDF using pdf-parse (Rule E3 — always extract at upload time)
  let extractedText = ''
  let needsOcr = false

  try {
    const pdfParseModule = await import('pdf-parse')
    const pdfParse = (pdfParseModule as any).default ?? pdfParseModule
    const parsed = await pdfParse(fileBuffer)
    extractedText = parsed.text ?? ''
  } catch (err) {
    console.warn('pdf-parse failed:', err)
    extractedText = ''
  }

  // Rule E3: If extracted_text < 100 chars, trigger OCR fallback
  if (extractedText.trim().length < 100) {
    needsOcr = true
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      // tesseract.js works on image files — for PDFs we flag needs_ocr for admin review
      // A full OCR pipeline would convert PDF pages to images first (out of scope for upload handler)
      await worker.terminate()
    } catch (err) {
      console.warn('Tesseract OCR not available:', err)
    }
    // Flag needs_ocr = true in DB so admin panel shows it for review
  }

  // is_free is determined by unit_no — admins never set it manually (Rule F2)
  const isFree = unitNo === 1

  // Extract topics via Claude API (only if we have meaningful text)
  let topics: string[] = []
  if (!needsOcr && extractedText.trim().length >= 100) {
    try {
      const model = await getConfig('claude_model') as string
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const topicResponse = await anthropic.messages.create({
        model,
        max_tokens: 256,
        system: 'Extract a list of topic names from the provided text. Return ONLY a JSON array of strings, e.g. ["Topic 1", "Topic 2"]. No explanation.',
        messages: [{ role: 'user', content: extractedText.slice(0, 8000) }],
      })
      const topicText = topicResponse.content
        .filter(c => c.type === 'text')
        .map(c => (c as any).text)
        .join('')
      topics = JSON.parse(topicText)
    } catch (err) {
      console.warn('Topic extraction failed:', err)
      topics = []
    }
  }

  // Insert materials row
  const { data: material, error: insertError } = await supabaseAdmin
    .from('materials')
    .insert({
      subject_id: subjectId,
      unit_no: unitNo,
      title,
      file_url: storagePath,
      extracted_text: extractedText || null,
      needs_ocr: needsOcr,
      topics,
      is_free: isFree,
      is_active: true,
    })
    .select('id, needs_ocr, topics')
    .single()

  if (insertError) {
    console.error('Failed to insert material:', insertError)
    return NextResponse.json({ message: 'Failed to save material' }, { status: 500 })
  }

  return NextResponse.json({
    materialId: material.id,
    needsOcr: material.needs_ocr,
    topics: material.topics,
    isFree,
    message: needsOcr
      ? 'Uploaded but OCR required — text extraction below threshold. Review in admin panel.'
      : 'Uploaded successfully.',
  })
}
