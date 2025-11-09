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

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '')
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function sanitizePlainText(value?: string): string | undefined {
  if (!value) return undefined

  const stripped = normalizeWhitespace(stripHtml(value))
  return stripped.length > 0 ? stripped : undefined
}

function sanitizeMultilineText(value: string): string {
  const withoutHtml = stripHtml(value)
  const normalized = withoutHtml
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')

  return normalized.length > 0 ? normalized : 'No reason provided'
}

function sanitizePhone(phone?: string): string | undefined {
  if (!phone) return undefined

  const stripped = normalizeWhitespace(stripHtml(phone))
  if (!stripped) return undefined

  const digits = stripped.replace(/\D/g, '')
  if (digits.length < 7) return undefined

  if (stripped.trim().startsWith('+')) {
    return `+${digits}`
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return digits
}

function sanitizeEmail(email?: string): string | undefined {
  if (!email) return undefined

  const stripped = normalizeWhitespace(stripHtml(email)).toLowerCase()
  if (!stripped) return undefined

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(stripped) ? stripped : undefined
}

function sanitizeUrl(url: string): string {
  const stripped = stripHtml(url).trim()

  if (!stripped) {
    return url
  }

  const compact = stripped.replace(/\s/g, '')

  try {
    // Validate URL structure without mutating the value used elsewhere
    new URL(compact)
    return compact
  } catch (error) {
    console.warn('[Slack] ⚠ Invalid URL format detected, using original value', error)
    return url
  }
}

function escapeSlackMarkdown(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendSlackNotification(
  options: SlackNotificationOptions
): Promise<{ success: boolean; error?: string; formattedMessage?: string }> {
  const fallbackCampaignName = options.campaignName.trim()
  const campaignNamePlain =
    sanitizePlainText(options.campaignName) || fallbackCampaignName || 'Unknown campaign'
  const fallbackTicketId = options.ticketId.trim()
  const ticketIdPlain = sanitizePlainText(options.ticketId) || fallbackTicketId || options.ticketId
  const ticketIdPreviewPlain = ticketIdPlain.slice(0, 8)
  const customerNamePlain = sanitizePlainText(options.customerName)
  const customerPhonePlain = sanitizePhone(options.customerPhone)
  const customerEmailPlain = sanitizeEmail(options.customerEmail)
  const reasonPlain = sanitizeMultilineText(options.reason)
  const acceptUrl = sanitizeUrl(options.acceptUrl)

  const campaignNameSlack = escapeSlackMarkdown(campaignNamePlain)
  const ticketIdPreviewSlack = escapeSlackMarkdown(ticketIdPreviewPlain)
  const reasonSlack = escapeSlackMarkdown(reasonPlain)
  const customerNameSlack =
    customerNamePlain !== undefined ? escapeSlackMarkdown(customerNamePlain) : undefined
  const customerPhoneSlack =
    customerPhonePlain !== undefined ? escapeSlackMarkdown(customerPhonePlain) : undefined
  const customerEmailSlack =
    customerEmailPlain !== undefined ? escapeSlackMarkdown(customerEmailPlain) : undefined

  console.log('[Slack] 🚀 Starting notification send...')
  console.log('[Slack] Campaign:', campaignNamePlain)
  console.log('[Slack] Customer:', customerNamePlain || 'No name provided')
  console.log('[Slack] Reason:', reasonPlain)
  console.log('[Slack] Accept URL:', acceptUrl)

  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.error('[Slack] ❌ SLACK_WEBHOOK_URL not configured in environment')
    return { success: false, error: 'Slack webhook not configured' }
  }

  console.log('[Slack] ✓ Webhook URL found, length:', webhookUrl.length)

  // Build rich Block Kit message
  const blocks: Array<Record<string, unknown>> = [
    // Header with urgency indicator
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🚨 URGENT: Visitor Needs Help',
        emoji: true,
      },
    },
    // Campaign and customer info section
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Campaign:*\n${campaignNameSlack}`,
        },
        {
          type: 'mrkdwn',
          text: `*Ticket ID:*\n${ticketIdPreviewSlack}`,
        },
      ],
    },
  ]

  // Add customer info if available
  if (customerNameSlack || customerPhoneSlack || customerEmailSlack) {
    const customerFields = []

    if (customerNameSlack) {
      customerFields.push({
        type: 'mrkdwn',
        text: `*Customer:*\n${customerNameSlack}`,
      })
    }

    if (customerPhoneSlack) {
      customerFields.push({
        type: 'mrkdwn',
        text: `*Phone:*\n${customerPhoneSlack}`,
      })
    }

    if (customerEmailSlack) {
      customerFields.push({
        type: 'mrkdwn',
        text: `*Email:*\n${customerEmailSlack}`,
      })
    }

    blocks.push({
      type: 'section',
      fields: customerFields,
    })
  }

  // Reason section
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Reason for Contact:*\n${reasonSlack}`,
    },
  })

  // Divider
  blocks.push({
    type: 'divider',
  })

  // Accept Call button
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '✅ Accept Call',
          emoji: true,
        },
        style: 'primary',
        url: acceptUrl,
        action_id: 'accept_call',
      },
    ],
  })

  // Context footer with expiry warning
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: '⚠️ This ticket expires in 10 minutes',
      },
    ],
  })

  const payload = {
    text: `URGENT: Visitor needs help - Campaign: ${campaignNamePlain}`, // Fallback text
    blocks,
  }

  const formattedLines = [
    '🚨 URGENT: Visitor Needs Help',
    '',
    `Campaign: ${campaignNamePlain}`,
    `Ticket ID: ${ticketIdPreviewPlain}`,
    '',
  ]

  if (customerNamePlain) {
    formattedLines.push(`Customer: ${customerNamePlain}`)
  }

  if (customerPhonePlain) {
    formattedLines.push(`Phone: ${customerPhonePlain}`)
  }

  if (customerEmailPlain) {
    formattedLines.push(`Email: ${customerEmailPlain}`)
  }

  formattedLines.push('Reason for Contact:')
  formattedLines.push(reasonPlain)
  formattedLines.push('')
  formattedLines.push(`Accept URL: ${acceptUrl}`)
  formattedLines.push('')
  formattedLines.push('⚠️ This ticket expires in 10 minutes')

  const formattedMessage = formattedLines.join('\n')

  console.log('[Slack] 📦 Payload blocks count:', blocks.length)
  console.log('[Slack] 📦 Full payload:', JSON.stringify(payload, null, 2))

  const maxAttempts = 2
  const timeoutMs = 5_000

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.error('[Slack] ⏰ Request timed out after', timeoutMs, 'ms (attempt', attempt, ')')
      controller.abort()
    }, timeoutMs)

    try {
      console.log(
        `[Slack] 🌐 Sending POST request to webhook (attempt ${attempt}/${maxAttempts})...`
      )

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log('[Slack] 📥 Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Slack] ❌ Failed to send notification:', response.status, errorText)

        if (attempt < maxAttempts && response.status >= 500) {
          console.warn('[Slack] 🔁 Retrying due to server error...')
          continue
        }

        return { success: false, error: `HTTP ${response.status}: ${errorText}`, formattedMessage }
      }

      const responseText = await response.text()
      console.log('[Slack] ✅ Response body:', responseText)
      console.log('[Slack] ✅ Notification sent successfully!')
      return { success: true, formattedMessage }
    } catch (error) {
      clearTimeout(timeoutId)

      const isAbortError = error instanceof Error && error.name === 'AbortError'

      if (isAbortError) {
        console.error('[Slack] ❌ Request aborted (likely due to timeout)')
      } else {
        console.error('[Slack] ❌ Network error:', error)
      }

      if (attempt < maxAttempts) {
        console.warn('[Slack] 🔁 Retrying Slack notification...')
        continue
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        success: false,
        error: isAbortError ? 'Request timed out' : errorMessage,
        formattedMessage,
      }
    }
  }

  return { success: false, error: 'Unable to send Slack notification', formattedMessage }
}
