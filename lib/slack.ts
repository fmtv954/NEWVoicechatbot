/**
 * Slack notification client for handoff alerts
 * Uses Incoming Webhooks to post messages to a channel
 */

import { sanitizeEmail, sanitizePhone, sanitizePlainText } from "./text"

interface SlackNotificationOptions {
  campaignName: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  reason: string
  acceptUrl: string
  ticketId: string
}

const MAX_FIELD_LENGTH = 256

export async function sendSlackNotification(
  options: SlackNotificationOptions,
): Promise<{ success: boolean; error?: string; formattedMessage?: string }> {
  const sanitizedCampaignName = sanitizePlainText(options.campaignName) ?? "Unknown Campaign"
  const sanitizedCustomerName = sanitizePlainText(options.customerName)
  const sanitizedCustomerPhone = sanitizePhone(options.customerPhone)
  const sanitizedCustomerEmail = sanitizeEmail(options.customerEmail)
  const sanitizedReason = sanitizePlainText(options.reason, { allowNewlines: true }) ?? "No reason provided"

  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.error("[Slack] SLACK_WEBHOOK_URL not configured")
    return { success: false, error: "Slack webhook not configured" }
  }

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🚨 URGENT: Visitor Needs Help",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Campaign:*\n${sanitizedCampaignName}`,
        },
        {
          type: "mrkdwn",
          text: `*Ticket ID:*\n${options.ticketId.slice(0, 8)}`,
        },
      ],
    },
  ]

  if (sanitizedCustomerName || sanitizedCustomerPhone || sanitizedCustomerEmail) {
    const customerFields = []

    if (sanitizedCustomerName) {
      customerFields.push({
        type: "mrkdwn",
        text: `*Customer:*\n${sanitizedCustomerName}`,
      })
    }

    if (sanitizedCustomerPhone) {
      customerFields.push({
        type: "mrkdwn",
        text: `*Phone:*\n${sanitizedCustomerPhone}`,
      })
    }

    if (sanitizedCustomerEmail) {
      customerFields.push({
        type: "mrkdwn",
        text: `*Email:*\n${sanitizedCustomerEmail}`,
      })
    }

    blocks.push({
      type: "section",
      fields: customerFields,
    })
  }

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Reason for Contact:*\n${sanitizedReason}`,
    },
  })

  blocks.push({
    type: "divider",
  })

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
    text: `URGENT: Visitor needs help - Campaign: ${sanitizedCampaignName}`,
    blocks,
  }

  const formattedMessage = `
🚨 URGENT: Visitor Needs Help

Campaign: ${sanitizedCampaignName}
Ticket ID: ${options.ticketId.slice(0, 8)}

${sanitizedCustomerName ? `Customer: ${sanitizedCustomerName}\n` : ""}${sanitizedCustomerPhone ? `Phone: ${sanitizedCustomerPhone}\n` : ""}${sanitizedCustomerEmail ? `Email: ${sanitizedCustomerEmail}\n` : ""}
Reason for Contact:
${sanitizedReason}

Accept URL: ${options.acceptUrl}

⚠️ This ticket expires in 10 minutes
`.trim()

  const maxAttempts = 2
  const timeoutMs = 5_000

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.error("[Slack] Request timed out (attempt", attempt, ")")
      controller.abort()
    }, timeoutMs)

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[Slack] Failed to send notification:", response.status, errorText)

        if (attempt < maxAttempts && response.status >= 500) {
          continue
        }

        return { success: false, error: `HTTP ${response.status}: ${errorText}`, formattedMessage }
      }

      return { success: true, formattedMessage }
    } catch (error) {
      clearTimeout(timeoutId)

      const isAbortError = error instanceof Error && error.name === "AbortError"

      if (isAbortError) {
        console.error("[Slack] Request aborted (timeout)")
      } else {
        console.error("[Slack] Network error:", error)
      }

      if (attempt < maxAttempts) {
        continue
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      return {
        success: false,
        error: isAbortError ? "Request timed out" : errorMessage,
        formattedMessage,
      }
    }
  }

  return { success: false, error: "Unable to send Slack notification", formattedMessage }
}
