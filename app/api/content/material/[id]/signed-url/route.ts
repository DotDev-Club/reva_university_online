// GET /api/content/material/[id]/signed-url
// Generates a 5-minute signed URL for a material PDF.
// Access checks run server-side — client never gets the raw storage path.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  getUserAccessFields,
  getMaterialWithSemester,
  canAccessMaterial,
  markFirstAccess,
  getUnit2PageLimit,
} from '@/lib/access-control'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: materialId } = await params

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user access fields and material in parallel
  const [userFields, material] = await Promise.all([
    getUserAccessFields(user.id),
    getMaterialWithSemester(materialId),
  ])

  if (!userFields) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 })
  }
  if (!material) {
    return NextResponse.json({ message: 'Material not found' }, { status: 404 })
  }

  // Run server-side access check (Rule 4.1 — never trust client)
  const access = await canAccessMaterial(userFields, material)

  if (!access.allowed) {
    return NextResponse.json(
      { message: 'Access denied', reason: access.reason },
      { status: 403 }
    )
  }

  // For Unit 2, check if free user is trying to access beyond page cutoff
  // The signed URL itself is only issued for allowed content.
  // The page limit is returned so the viewer can enforce the cutoff client-side
  // (visual only — server has already gated the URL).
  let unit2PagePct: number | null = null
  if (material.unit_no === 2 && !userFields.is_early_user && material.is_free) {
    unit2PagePct = await getUnit2PageLimit()
  }

  // Fetch the full material row to get file_url
  const { data: materialRow, error: matError } = await supabaseAdmin
    .from('materials')
    .select('file_url')
    .eq('id', materialId)
    .single()

  if (matError || !materialRow) {
    return NextResponse.json({ message: 'Material not found' }, { status: 404 })
  }

  // Generate 5-minute signed URL — never cache (Rule G3 / A4)
  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from('materials')
    .createSignedUrl(materialRow.file_url, 300) // 300 seconds = 5 minutes

  if (signedError || !signedData) {
    console.error('Failed to generate signed URL:', signedError)
    return NextResponse.json({ message: 'Failed to generate URL' }, { status: 500 })
  }

  // Mark first paid content access for refund eligibility (Appendix P §6.2)
  if (!material.is_free && !userFields.is_early_user) {
    // Fire-and-forget — don't block the response
    markFirstAccess(user.id).catch(console.error)
  }

  return NextResponse.json({
    url: signedData.signedUrl,
    expiresIn: 300,
    unit2PagePct, // null unless this is a Unit 2 material for a free user
  })
}
