#!/usr/bin/env tsx
/**
 * Manual handoff trigger helper.
 *
 * Usage:
 *   pnpm tsx scripts/test-handoff-request.ts --agent-id=<uuid> --campaign-id=<uuid> [--reason="Manual QA"]
 *
 * Environment:
 *   - NEXT_PUBLIC_APP_URL (defaults to http://localhost:3000)
 *   - Optionally set HANDOFF_BASE_URL to override the request target.
 *
 * The script posts to /api/handoff/request and prints the response body so you
 * can confirm a 200 OK and inspect any delivered Slack payload preview.
 */

type CliArgs = {
  agentId?: string
  campaignId?: string
  reason?: string
  callId?: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {}

  for (const token of argv) {
    if (!token.startsWith('--')) continue

    const [flag, rawValue] = token.slice(2).split('=')
    const value = rawValue ?? ''

    switch (flag) {
      case 'agent-id':
        args.agentId = value || undefined
        break
      case 'campaign-id':
        args.campaignId = value || undefined
        break
      case 'call-id':
        args.callId = value || undefined
        break
      case 'reason':
        args.reason = value || undefined
        break
      default:
        console.warn(`Unknown flag "${flag}" ignored`)
    }
  }

  return args
}

async function main() {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)

  const agentId = args.agentId ?? process.env.HANDOFF_AGENT_ID
  const campaignId = args.campaignId ?? process.env.HANDOFF_CAMPAIGN_ID
  const callId = args.callId ?? process.env.HANDOFF_CALL_ID
  const reason =
    args.reason ??
    process.env.HANDOFF_REASON ??
    `Manual QA trigger ${new Date().toISOString().replace('T', ' ')}`.slice(0, 255)

  const baseUrl =
    process.env.HANDOFF_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'

  if (!agentId || !campaignId) {
    console.error(
      'Missing required identifiers. Provide --agent-id and --campaign-id flags, or set HANDOFF_AGENT_ID / HANDOFF_CAMPAIGN_ID.'
    )
    process.exit(1)
  }

  const url = new URL('/api/handoff/request', baseUrl)
  const payload = {
    agent_id: agentId,
    campaign_id: campaignId,
    call_id: callId,
    reason,
  }

  console.log('⇢ POST', url.toString())
  console.log('⇢ Payload', JSON.stringify(payload, null, 2))

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const contentType = response.headers.get('content-type') ?? ''
    const isJson = contentType.includes('application/json')
    const body = isJson ? await response.json() : await response.text()

    console.log('⇣ Status', response.status, response.statusText)
    console.log('⇣ Headers', Object.fromEntries(response.headers.entries()))

    if (isJson) {
      console.log('⇣ Response JSON', JSON.stringify(body, null, 2))
    } else {
      console.log('⇣ Response Body', body)
    }

    if (!response.ok) {
      console.error(
        '✗ Request failed. Double-check environment variables and Slack webhook configuration.'
      )
      process.exitCode = 1
      return
    }

    console.log('✓ Handoff request accepted. Verify Slack for the notification card.')
  } catch (error) {
    console.error('✗ Network error while requesting handoff:', error)
    process.exitCode = 1
  }
}

void main()
