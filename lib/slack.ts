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

const MAX_FIELD_LENGTH = 256

function sanitizePlainText(
  value?: string,
  { allowNewlines = false }: { allowNewlines?: boolean } = {}
): string | undefined {
  if (!value) {
    return undefined
  }

  const withoutTags = value.replace(/<[^>]*>/g, '')

  let normalizedWhitespace: string

  if (allowNewlines) {
    const lines = withoutTags
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) =>
        line
          .replace(/[\t\f\v]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      )

    const collapsedBlankLines = lines.filter((line, index, array) => {
      if (line.length > 0) {
        return true
      }

      const prevLine = array[index - 1]
      return Boolean(prevLine && prevLine.length > 0)
    })

    normalizedWhitespace = collapsedBlankLines.join('\n')
  } else {
    normalizedWhitespace = withoutTags.replace(/\s+/g, ' ')
  }

  const escapedSpecial = normalizedWhitespace.replace(/[<>&]/g, (char) => {
    switch (char) {
      case '<':
        return '\u2039'
      case '>':
        return '\u203a'
      case '&':
        return 'and'
      default:
        return char
    }
  })

  const strippedControl = escapedSpecial.replace(/[\u0000-\u001f\u007f]/g, '')

  const trimmed = strippedControl.trim()

  if (!trimmed) {
    return undefined
  }

  return trimmed.slice(0, MAX_FIELD_LENGTH)
}

function sanitizePhone(value?: string): string | undefined {
  const cleaned = sanitizePlainText(value)
  if (!cleaned) {
    return undefined
  }

  const hasLeadingPlus = cleaned.trim().startsWith('+')
  const digitsOnly = cleaned.replace(/\D/g, '')

  if (!digitsOnly) {
    return undefined
  }

  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`
  }

  if (hasLeadingPlus) {
    return `+${digitsOnly}`.slice(0, MAX_FIELD_LENGTH)
  }

  return digitsOnly.slice(0, MAX_FIELD_LENGTH)
}

function sanitizeEmail(value?: string): string | undefined {
  const cleaned = sanitizePlainText(value)
  if (!cleaned) {
    return undefined
  }

  const normalized = cleaned.toLowerCase()
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailPattern.test(normalized)) {
    return undefined
  }

  return normalized.slice(0, MAX_FIELD_LENGTH)
}

export async function sendSlackNotification(
  options: SlackNotificationOptions
): Promise<{ success: boolean; error?: string; formattedMessage?: string }> {
  const sanitizedCampaignName = sanitizePlainText(options.campaignName) ?? 'Unknown Campaign'
  const sanitizedCustomerName = sanitizePlainText(options.customerName)
  const sanitizedCustomerPhone = sanitizePhone(options.customerPhone)
  const sanitizedCustomerEmail = sanitizeEmail(options.customerEmail)
  const sanitizedReason =
    sanitizePlainText(options.reason, { allowNewlines: true }) ?? 'No reason provided'

  console.log('[Slack] 🚀 Starting notification send...')
  console.log('[Slack] Campaign:', sanitizedCampaignName)
  console.log('[Slack] Customer:', sanitizedCustomerName || 'No name provided')
  console.log('[Slack] Reason:', sanitizedReason)
  console.log('[Slack] Accept URL:', options.acceptUrl)

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
          text: `*Campaign:*\n${sanitizedCampaignName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Ticket ID:*\n${options.ticketId.slice(0, 8)}`,
        },
      ],
    },
  ]

  // Add customer info if available
  if (sanitizedCustomerName || sanitizedCustomerPhone || sanitizedCustomerEmail) {
    const customerFields = []

    if (sanitizedCustomerName) {
      customerFields.push({
        type: 'mrkdwn',
        text: `*Customer:*\n${sanitizedCustomerName}`,
      })
    }

    if (sanitizedCustomerPhone) {
      customerFields.push({
        type: 'mrkdwn',
        text: `*Phone:*\n${sanitizedCustomerPhone}`,
      })
    }

    if (sanitizedCustomerEmail) {
      customerFields.push({
        type: 'mrkdwn',
        text: `*Email:*\n${sanitizedCustomerEmail}`,
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
      text: `*Reason for Contact:*\n${sanitizedReason}`,
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
        url: options.acceptUrl,
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
    text: `URGENT: Visitor needs help - Campaign: ${sanitizedCampaignName}`, // Fallback text
    blocks,
  }

  const formattedMessage = `
🚨 URGENT: Visitor Needs Help

Campaign: ${sanitizedCampaignName}
Ticket ID: ${options.ticketId.slice(0, 8)}

${sanitizedCustomerName ? `Customer: ${sanitizedCustomerName}\n` : ''}${sanitizedCustomerPhone ? `Phone: ${sanitizedCustomerPhone}\n` : ''}${sanitizedCustomerEmail ? `Email: ${sanitizedCustomerEmail}\n` : ''}
Reason for Contact:
${sanitizedReason}

Accept URL: ${options.acceptUrl}

⚠️ This ticket expires in 10 minutes
`.trim()

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
