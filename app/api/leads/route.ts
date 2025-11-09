import { type NextRequest, NextResponse } from 'next/server'
import { fetchAdminLeads } from '@/app/admin/leads/queries'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { pushEvent } from '@/lib/calls'

/**
 * POST /api/leads
 * Saves a lead to the database after read-back confirmation
 * Called by the AI model when the user confirms with "Yes"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const {
      agent_id,
      campaign_id,
      first_name,
      last_name,
      email,
      phone,
      reason,
      transcript,
      call_id,
    } = body

    if (
      !agent_id ||
      !campaign_id ||
      !first_name ||
      !last_name ||
      !email ||
      !phone ||
      !reason ||
      !transcript
    ) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: [
            'agent_id',
            'campaign_id',
            'first_name',
            'last_name',
            'email',
            'phone',
            'reason',
            'transcript',
          ],
        },
        { status: 400 }
      )
    }

    // Insert lead into database
    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert({
        agent_id,
        campaign_id,
        first_name,
        last_name,
        email,
        phone,
        reason,
        transcript,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[saveLead] Database error:', error)
      return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
    }

    if (call_id) {
      await pushEvent({
        call_id,
        type: 'lead_saved',
        payload: {
          lead_id: data.id,
          email,
          phone,
        },
      })
    }

    return NextResponse.json({
      ok: true,
      lead_id: data.id,
    })
  } catch (error) {
    console.error('[saveLead] Error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get('limit')
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 1000) : 500

  const { leads, error } = await fetchAdminLeads(limit)

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json({ leads })
}
