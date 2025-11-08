import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { sendSlackNotification } from "@/lib/slack"
import jwt from "jsonwebtoken"
import { pushEvent } from "@/lib/calls"

export async function POST(request: NextRequest) {
  console.log("=".repeat(80))
  console.log("[Handoff] 🚨 NEW HANDOFF REQUEST RECEIVED")
  console.log("[Handoff] Timestamp:", new Date().toISOString())
  console.log("=".repeat(80))

  try {
    const body = await request.json()
    console.log("[Handoff] 📦 Request body:", JSON.stringify(body, null, 2))

    const { agent_id, campaign_id, call_id, reason } = body

    // Validate required fields
    if (!agent_id || !campaign_id || !reason) {
      console.error("[Handoff] ❌ Missing required fields:", { agent_id, campaign_id, reason })
      return NextResponse.json({ error: "Missing required fields: agent_id, campaign_id, reason" }, { status: 400 })
    }

    console.log("[Handoff] ✓ Required fields validated")
    console.log("[Handoff] - Agent ID:", agent_id)
    console.log("[Handoff] - Campaign ID:", campaign_id)
    console.log("[Handoff] - Call ID:", call_id || "No call ID provided")
    console.log("[Handoff] - Reason:", reason)

    // Get campaign details
    console.log("[Handoff] 🔍 Fetching campaign details...")
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("name")
      .eq("id", campaign_id)
      .single()

    if (campaignError || !campaign) {
      console.error("[Handoff] ❌ Campaign not found:", campaignError)
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    console.log("[Handoff] ✓ Campaign found:", campaign.name)

    let leadInfo: { first_name?: string; last_name?: string; email?: string; phone?: string } | null = null
    if (call_id) {
      console.log("[Handoff] 🔍 Fetching lead information for call...")

      const { data: leadEvent, error: leadEventError } = await supabaseAdmin
        .from("call_events")
        .select("payload_json")
        .eq("call_id", call_id)
        .eq("type", "lead_saved")
        .order("ts", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (leadEventError) {
        console.error("[Handoff] ⚠ Failed to fetch lead_saved event for call:", leadEventError)
      }

      const leadPayload = (leadEvent?.payload_json as { lead_id?: string } | null) ?? null
      const leadId = leadPayload?.lead_id

      if (leadId) {
        const { data: lead, error: leadError } = await supabaseAdmin
          .from("leads")
          .select("first_name, last_name, email, phone")
          .eq("id", leadId)
          .maybeSingle()

        if (leadError) {
          console.error("[Handoff] ⚠ Failed to fetch lead info for call:", leadError)
        } else if (lead) {
          leadInfo = lead
          console.log("[Handoff] ✓ Lead info found:", {
            name: [lead.first_name, lead.last_name].filter(Boolean).join(" "),
            email: lead.email,
            phone: lead.phone,
          })
        } else {
          console.log("[Handoff] ⚠ Lead referenced in call events was not found")
        }
      } else {
        console.log("[Handoff] ⚠ No lead_saved event found for this call")
      }
    }

    // Create handoff ticket (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    console.log("[Handoff] 🎫 Creating handoff ticket...")
    console.log("[Handoff] - Expires at:", expiresAt.toISOString())

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
      console.error("[Handoff] ❌ Failed to create ticket:", ticketError)
      return NextResponse.json(
        { error: "Failed to create handoff ticket", details: ticketError?.message },
        { status: 500 },
      )
    }

    console.log("[Handoff] ✅ Ticket created successfully!")
    console.log("[Handoff] - Ticket ID:", ticket.id)
    console.log("[Handoff] - Status:", ticket.status)

    if (call_id) {
      console.log("[Handoff] 📝 Logging handoff_requested event...")
      await pushEvent({
        call_id,
        type: "handoff_requested",
        payload: {
          ticket_id: ticket.id,
          reason,
        },
      })
      console.log("[Handoff] ✓ Event logged")
    }

    // Mint one-time JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error("[Handoff] ❌ JWT_SECRET not configured")
      return NextResponse.json({ error: "Server configuration error: JWT_SECRET missing" }, { status: 500 })
    }

    console.log("[Handoff] 🔐 Generating JWT token...")
    const token = jwt.sign(
      {
        ticket_id: ticket.id,
        campaign_id,
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
      jwtSecret,
    )
    console.log("[Handoff] ✓ JWT token generated (length:", token.length, ")")

    const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const acceptUrl = `${publicBaseUrl}/agent/accept?token=${token}`
    console.log("[Handoff] 🔗 Accept URL:", acceptUrl)

    const customerName =
      leadInfo && (leadInfo.first_name || leadInfo.last_name)
        ? [leadInfo.first_name, leadInfo.last_name].filter(Boolean).join(" ")
        : undefined

    console.log("[Handoff] 📧 Preparing Slack notification...")
    console.log("[Handoff] - Campaign:", campaign.name)
    console.log("[Handoff] - Customer:", customerName || "Anonymous")
    console.log("[Handoff] - Reason:", reason)
    console.log("[Handoff] - Has lead data:", !!leadInfo)

    const slackWebhook = process.env.SLACK_WEBHOOK_URL
    if (!slackWebhook) {
      console.error("[Handoff] ❌ SLACK_WEBHOOK_URL not configured")
      return NextResponse.json({ error: "Server configuration error: SLACK_WEBHOOK_URL missing" }, { status: 500 })
    }

    const slackResult = await sendSlackNotification({
      campaignName: campaign.name,
      customerName,
      customerPhone: leadInfo?.phone,
      customerEmail: leadInfo?.email,
      reason,
      acceptUrl,
      ticketId: ticket.id,
    })

    if (slackResult.success) {
      console.log("[Handoff] ✅ Slack notification sent successfully!")

      if (call_id) {
        console.log("[Handoff] 📝 Logging slack_notification_sent event...")
        await pushEvent({
          call_id,
          type: "slack_notification_sent",
          payload: {
            ticket_id: ticket.id,
          },
        })
      }
    } else {
      console.error("[Handoff] ❌ Slack notification failed:", slackResult.error)
      return NextResponse.json(
        {
          error: "Failed to send Slack notification",
          details: slackResult.error,
          ticket_id: ticket.id,
        },
        { status: 500 },
      )
    }

    console.log("=".repeat(80))
    console.log("[Handoff] ✅ HANDOFF REQUEST COMPLETED SUCCESSFULLY")
    console.log("[Handoff] Summary:")
    console.log("[Handoff] - Ticket ID:", ticket.id)
    console.log("[Handoff] - Notification sent:", slackResult.success)
    console.log("[Handoff] - Accept URL ready for agent")
    console.log("=".repeat(80))

    return NextResponse.json({
      ok: true,
      ticket_id: ticket.id,
      notification_sent: slackResult.success,
      slackMessage: slackResult.formattedMessage,
    })
  } catch (error) {
    console.error("=".repeat(80))
    console.error("[Handoff] ❌ REQUEST FAILED WITH ERROR")
    console.error("[Handoff] Error:", error)
    console.error("[Handoff] Stack:", error instanceof Error ? error.stack : "No stack trace")
    console.error("=".repeat(80))

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
