import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { sendSMS } from "@/lib/sms"
import jwt from "jsonwebtoken"
import { pushEvent } from "@/lib/calls"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id, campaign_id, call_id, reason } = body

    // Validate required fields
    if (!agent_id || !campaign_id || !reason) {
      return NextResponse.json({ error: "Missing required fields: agent_id, campaign_id, reason" }, { status: 400 })
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("name")
      .eq("id", campaign_id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    let leadInfo: { first_name?: string; last_name?: string; email?: string; phone?: string } | null = null
    if (call_id) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("first_name, last_name, email, phone")
        .eq("campaign_id", campaign_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (lead) {
        leadInfo = lead
      }
    }

    // Create handoff ticket (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("handoff_tickets")
      .insert({
        agent_id,
        campaign_id,
        call_id,
        reason,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (ticketError || !ticket) {
      console.error("[Handoff] Failed to create ticket:", ticketError)
      return NextResponse.json({ error: "Failed to create handoff ticket" }, { status: 500 })
    }

    if (call_id) {
      await pushEvent({
        call_id,
        type: "handoff_requested",
        payload: {
          ticket_id: ticket.id,
          reason,
        },
      })
    }

    // Mint one-time JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error("[Handoff] JWT_SECRET not configured")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const token = jwt.sign(
      {
        ticket_id: ticket.id,
        campaign_id,
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
      jwtSecret,
    )

    // Get all on-call agent contacts
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from("agent_contacts")
      .select("phone_e164")
      .eq("agent_id", agent_id)
      .eq("is_on_call", true)

    if (contactsError || !contacts || contacts.length === 0) {
      console.warn("[Handoff] No on-call contacts found for agent:", agent_id)
      return NextResponse.json({ error: "No on-call agents available" }, { status: 503 })
    }

    const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const acceptUrl = `${publicBaseUrl}/agent/accept?token=${token}`

    let smsBody = `URGENT: Visitor needs help (Campaign: ${campaign.name})\n`

    if (leadInfo && (leadInfo.first_name || leadInfo.last_name || leadInfo.email || leadInfo.phone)) {
      const customerName = [leadInfo.first_name, leadInfo.last_name].filter(Boolean).join(" ") || "Unknown"
      const customerPhone = leadInfo.phone || "N/A"
      const customerEmail = leadInfo.email || "N/A"

      smsBody += `Customer: ${customerName}  Phone: ${customerPhone}  Email: ${customerEmail}\n`
    }

    smsBody += `Reason: ${reason}\n`
    smsBody += `Join: ${acceptUrl}\n`
    smsBody += `Reply STOP to stop, HELP for help.`

    // Check if Twilio is configured
    const twilioConfigured =
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER

    if (!twilioConfigured) {
      console.warn("[Handoff] Twilio not configured - SMS disabled")
      // Still create the ticket but don't send SMS
      return NextResponse.json({
        ok: true,
        ticket_id: ticket.id,
        warning: "SMS notifications disabled - Twilio not configured",
      })
    }

    const smsResults = []
    for (const contact of contacts) {
      try {
        const result = await sendSMS({
          to: contact.phone_e164,
          body: smsBody,
        })

        // Log SMS message
        await supabaseAdmin.from("sms_messages").insert({
          ticket_id: ticket.id,
          to_number: contact.phone_e164,
          body: smsBody,
          provider_message_id: result.sid,
          status: result.status,
        })

        if (call_id) {
          await pushEvent({
            call_id,
            type: "sms_sent",
            payload: {
              to_number: contact.phone_e164,
              sms_id: result.sid,
            },
          })
        }

        smsResults.push({ to: contact.phone_e164, sid: result.sid, status: result.status })
      } catch (error) {
        console.error(`[Handoff] Failed to send SMS to ${contact.phone_e164}:`, error)
        // Log failed SMS
        await supabaseAdmin.from("sms_messages").insert({
          ticket_id: ticket.id,
          to_number: contact.phone_e164,
          body: smsBody,
          provider_message_id: null,
          status: "failed",
        })
      }
    }

    return NextResponse.json({
      ok: true,
      ticket_id: ticket.id,
      sms_sent: smsResults.length,
    })
  } catch (error) {
    console.error("[Handoff] Request failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
