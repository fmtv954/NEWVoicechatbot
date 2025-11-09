import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import jwt from 'jsonwebtoken'
import { AccessToken } from 'livekit-server-sdk'
import { pushEvent } from '@/lib/calls'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    // Verify JWT
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('[Handoff Accept] JWT_SECRET not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    let decoded: any
    try {
      decoded = jwt.verify(token, jwtSecret)
    } catch (error) {
      console.error('[Handoff Accept] Invalid token:', error)
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const { ticket_id } = decoded

    // Get ticket and check if it's still pending
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('handoff_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Check if ticket is still pending and not expired
    if (ticket.status !== 'pending') {
      return NextResponse.json(
        {
          error: `Ticket already ${ticket.status}`,
          status: ticket.status,
          accepted_at: ticket.accepted_at,
        },
        { status: 409 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(ticket.expires_at)
    if (now > expiresAt) {
      // Update ticket to timeout
      await supabaseAdmin.from('handoff_tickets').update({ status: 'timeout' }).eq('id', ticket_id)

      if (ticket.call_id) {
        await pushEvent({
          call_id: ticket.call_id,
          type: 'handoff_timeout',
          payload: {
            ticket_id: ticket.id,
          },
        })
      }

      return NextResponse.json(
        {
          error: 'Ticket expired',
          expires_at: ticket.expires_at,
        },
        { status: 410 }
      )
    }

    let leadInfo: {
      first_name?: string
      last_name?: string
      email?: string
      phone?: string
    } | null = null
    if (ticket.call_id) {
      const { data: leadEvent, error: leadEventError } = await supabaseAdmin
        .from('call_events')
        .select('payload_json')
        .eq('call_id', ticket.call_id)
        .eq('type', 'lead_saved')
        .order('ts', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (leadEventError) {
        console.error('[Handoff Accept] Failed to load lead_saved event:', leadEventError)
      }

      const leadId = (leadEvent?.payload_json as { lead_id?: string } | null)?.lead_id

      if (leadId) {
        const { data: lead, error: leadError } = await supabaseAdmin
          .from('leads')
          .select('first_name, last_name, email, phone')
          .eq('id', leadId)
          .maybeSingle()

        if (leadError) {
          console.error('[Handoff Accept] Failed to fetch lead details for ticket:', leadError)
        } else if (lead) {
          leadInfo = lead
        }
      }
    }

    // Mark ticket as accepted
    const { error: updateError } = await supabaseAdmin
      .from('handoff_tickets')
      .update({
        status: 'accepted',
        accepted_at: now.toISOString(),
      })
      .eq('id', ticket_id)

    if (updateError) {
      console.error('[Handoff Accept] Failed to update ticket:', updateError)
      return NextResponse.json({ error: 'Failed to accept ticket' }, { status: 500 })
    }

    if (ticket.call_id) {
      await pushEvent({
        call_id: ticket.call_id,
        type: 'handoff_accepted',
        payload: {
          ticket_id: ticket.id,
          accepted_at: now.toISOString(),
        },
      })
    }

    // Mint LiveKit room token
    const livekitApiKey = process.env.LIVEKIT_API_KEY
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET
    const livekitUrl = process.env.LIVEKIT_URL

    if (!livekitApiKey || !livekitApiSecret || !livekitUrl) {
      console.error('[Handoff Accept] LiveKit credentials not configured')
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
    }

    const roomName = `handoff-${ticket_id}`
    const participantName = `agent-${Date.now()}`

    const accessToken = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: participantName,
    })

    accessToken.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    })

    const livekitToken = await accessToken.toJwt()

    return NextResponse.json({
      ok: true,
      ticket_id,
      call_id: ticket.call_id,
      room_name: roomName,
      livekit_token: livekitToken,
      livekit_url: livekitUrl,
      lead: leadInfo,
      reason: ticket.reason,
    })
  } catch (error) {
    console.error('[Handoff Accept] Failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
