/**
 * Slack notification client for handoff alerts
 * Uses Incoming Webhooks to post messages to a channel
 */

interface SlackNotificationOptions {
  campaignName: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  reason: string
  acceptUrl: string
  ticketId: string
}

export async function sendSlackNotification(
  options: SlackNotificationOptions,
): Promise<{ success: boolean; error?: string; formattedMessage?: string }> {
  console.log("[Slack] 🚀 Starting notification send...")
  console.log("[Slack] Campaign:", options.campaignName)
  console.log("[Slack] Customer:", options.customerName || "No name provided")
  console.log("[Slack] Reason:", options.reason)
  console.log("[Slack] Accept URL:", options.acceptUrl)

  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.error("[Slack] ❌ SLACK_WEBHOOK_URL not configured in environment")
    return { success: false, error: "Slack webhook not configured" }
  }

  console.log("[Slack] ✓ Webhook URL found, length:", webhookUrl.length)

  // Build rich Block Kit message
  const blocks = [
    // Header with urgency indicator
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🚨 URGENT: Visitor Needs Help",
        emoji: true,
      },
    },
    // Campaign and customer info section
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Campaign:*\n${options.campaignName}`,
        },
        {
          type: "mrkdwn",
          text: `*Ticket ID:*\n${options.ticketId.slice(0, 8)}`,
        },
      ],
    },
  ]

  // Add customer info if available
  if (options.customerName || options.customerPhone || options.customerEmail) {
    const customerFields = []

    if (options.customerName) {
      customerFields.push({
        type: "mrkdwn",
        text: `*Customer:*\n${options.customerName}`,
      })
    }

    if (options.customerPhone) {
      customerFields.push({
        type: "mrkdwn",
        text: `*Phone:*\n${options.customerPhone}`,
      })
    }

    if (options.customerEmail) {
      customerFields.push({
        type: "mrkdwn",
        text: `*Email:*\n${options.customerEmail}`,
      })
    }

    blocks.push({
      type: "section",
      fields: customerFields,
    })
  }

  // Reason section
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Reason for Contact:*\n${options.reason}`,
    },
  })

  // Divider
  blocks.push({
    type: "divider",
  })

  // Accept Call button
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "✅ Accept Call",
          emoji: true,
        },
        style: "primary",
        url: options.acceptUrl,
        action_id: "accept_call",
      },
    ],
  })

  // Context footer with expiry warning
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "⚠️ This ticket expires in 10 minutes",
      },
    ],
  })

  const payload = {
    text: `URGENT: Visitor needs help - Campaign: ${options.campaignName}`, // Fallback text
    blocks,
  }

  const formattedMessage = `
🚨 URGENT: Visitor Needs Help

Campaign: ${options.campaignName}
Ticket ID: ${options.ticketId.slice(0, 8)}

${options.customerName ? `Customer: ${options.customerName}\n` : ""}${options.customerPhone ? `Phone: ${options.customerPhone}\n` : ""}${options.customerEmail ? `Email: ${options.customerEmail}\n` : ""}
Reason for Contact:
${options.reason}

Accept URL: ${options.acceptUrl}

⚠️ This ticket expires in 10 minutes
`.trim()

  console.log("[Slack] 📦 Payload blocks count:", blocks.length)
  console.log("[Slack] 📦 Full payload:", JSON.stringify(payload, null, 2))

  try {
    console.log("[Slack] 🌐 Sending POST request to webhook...")

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    console.log("[Slack] 📥 Response status:", response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Slack] ❌ Failed to send notification:", response.status, errorText)
      return { success: false, error: `HTTP ${response.status}: ${errorText}`, formattedMessage }
    }

    const responseText = await response.text()
    console.log("[Slack] ✅ Response body:", responseText)
    console.log("[Slack] ✅ Notification sent successfully!")
    return { success: true, formattedMessage }
  } catch (error) {
    console.error("[Slack] ❌ Network error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      formattedMessage,
    }
  }
}
