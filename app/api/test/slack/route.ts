import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  console.log("[Slack Test] 🧪 Starting Slack webhook test...")

  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.error("[Slack Test] ❌ SLACK_WEBHOOK_URL not configured")
    return NextResponse.json(
      { success: false, error: "SLACK_WEBHOOK_URL environment variable not set" },
      { status: 500 },
    )
  }

  console.log("[Slack Test] ✓ Webhook URL found:", webhookUrl.substring(0, 50) + "...")

  // Simple test message
  const testPayload = {
    text: "🧪 Test message from Voice AI Chat",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🧪 Slack Webhook Test",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "This is a test message to verify your Slack webhook is working correctly.",
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Timestamp:*\n${new Date().toISOString()}`,
          },
          {
            type: "mrkdwn",
            text: "*Status:*\n✅ Connected",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "If you see this message, your webhook is configured correctly!",
          },
        ],
      },
    ],
  }

  try {
    console.log("[Slack Test] 🚀 Sending test message...")

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    })

    const responseText = await response.text()

    console.log("[Slack Test] 📥 Response status:", response.status)
    console.log("[Slack Test] 📥 Response body:", responseText)

    if (!response.ok) {
      console.error("[Slack Test] ❌ Failed with status:", response.status)
      return NextResponse.json(
        {
          success: false,
          error: `Slack API returned ${response.status}: ${responseText}`,
          statusCode: response.status,
        },
        { status: 500 },
      )
    }

    console.log("[Slack Test] ✅ Test message sent successfully!")

    return NextResponse.json({
      success: true,
      message: "Test message sent to Slack successfully!",
      webhookUrl: webhookUrl.substring(0, 50) + "...",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Slack Test] ❌ Error sending test message:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        success: false,
        error: `Failed to send test message: ${errorMessage}`,
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to test the Slack webhook",
    endpoint: "/api/test/slack",
    method: "POST",
  })
}
