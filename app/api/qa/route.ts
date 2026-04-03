// POST /api/qa
// Claude Q&A for paid users — subject-scoped, stateless, rate-limited.
// Rules E1–E4 from the build spec.
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUserAccessFields, canAccessMaterial } from '@/lib/access-control'
import { getConfig } from '@/lib/app-config'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  let body: { subjectId: string; question: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const { subjectId, question } = body
  if (!subjectId || !question || typeof question !== 'string' || question.trim().length === 0) {
    return NextResponse.json({ message: 'subjectId and question are required' }, { status: 400 })
  }

  // Fetch user access fields
  const userFields = await getUserAccessFields(user.id)
  if (!userFields) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 })
  }

  // Rule E1: Q&A is paid-only (early users count as paid)
  if (
    !userFields.is_early_user &&
    (!userFields.subscription_expires_at ||
      new Date(userFields.subscription_expires_at) < new Date())
  ) {
    return NextResponse.json({ message: 'Q&A is a paid feature. Upgrade to access.' }, { status: 403 })
  }

  // Fetch subject + department for context
  const { data: subject, error: subjectError } = await supabaseAdmin
    .from('subjects')
    .select('id, name, semester, dept_id, dept:departments(name)')
    .eq('id', subjectId)
    .eq('is_active', true)
    .single()

  if (subjectError || !subject) {
    return NextResponse.json({ message: 'Subject not found' }, { status: 404 })
  }

  // Verify the subject is in the user's subscription semester (or early user)
  if (!userFields.is_early_user && subject.semester !== userFields.subscription_semester) {
    return NextResponse.json(
      { message: 'This subject is outside your subscription semester.' },
      { status: 403 }
    )
  }

  // Rule E4: Rate limiting — server-side daily counter
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const qaLimit = await getConfig('qa_daily_limit')

  const { data: usageRow } = await supabaseAdmin
    .from('qa_usage')
    .select('count')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  const currentCount = usageRow?.count ?? 0
  if (currentCount >= qaLimit) {
    return NextResponse.json(
      { message: `Daily Q&A limit of ${qaLimit} reached. Resets at midnight IST.` },
      { status: 429 }
    )
  }

  // Fetch extracted_text for all active materials in this subject (Rule E2 & E3)
  const { data: materials } = await supabaseAdmin
    .from('materials')
    .select('unit_no, title, extracted_text, needs_ocr')
    .eq('subject_id', subjectId)
    .eq('is_active', true)
    .order('unit_no')

  if (!materials || materials.length === 0) {
    return NextResponse.json({ message: 'No materials found for this subject.' }, { status: 404 })
  }

  // Rule E3: Flag if any unit needs OCR
  const needsOcrUnits = materials.filter(m => m.needs_ocr).map(m => m.unit_no)

  // Concatenate extracted text from all active units
  const notesContent = materials
    .map(m => `[${m.title}]\n${m.extracted_text ?? ''}`)
    .join('\n\n---\n\n')

  // Rule E3: If extracted_text is empty/short, don't silently pass empty context
  if (notesContent.replace(/\[.*?\]/g, '').trim().length < 100) {
    return NextResponse.json(
      { message: 'Subject notes are not yet indexed. Please check back later.' },
      { status: 503 }
    )
  }

  const dept = Array.isArray(subject.dept) ? subject.dept[0] : subject.dept

  // Build subject-scoped system prompt (Rule E2)
  const systemPrompt = `You are a study assistant for Reva University students.
Answer ONLY based on the subject notes provided below.
Do not use any external knowledge. If the answer is not in the notes, say: 'This topic is not covered in the uploaded material.'

Subject: ${subject.name} | Semester: ${subject.semester} | Dept: ${(dept as any)?.name ?? ''}

--- NOTES CONTENT START ---
${notesContent}
--- NOTES CONTENT END ---`

  // Call Claude API (model from app_config)
  const model = await getConfig('claude_model') as string
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const message = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: question.trim() }],
  })

  const answer = message.content
    .filter(c => c.type === 'text')
    .map(c => (c as any).text)
    .join('')

  // Increment qa_usage counter (upsert)
  await supabaseAdmin
    .from('qa_usage')
    .upsert(
      { user_id: user.id, date: today, count: currentCount + 1 },
      { onConflict: 'user_id,date' }
    )

  return NextResponse.json({
    answer,
    questionsRemaining: qaLimit - (currentCount + 1),
    needsOcrUnits: needsOcrUnits.length > 0 ? needsOcrUnits : undefined,
  })
}
