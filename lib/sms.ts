import twilio from "twilio"

/**
 * Sends SMS messages using Twilio
 * Supports both Messaging Service SID and direct phone number
 */
export async function sendSMS(options: {
  to: string
  body: string
}): Promise<{ sid: string; status: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  // Check if Twilio is configured
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured")
  }

  if (!fromNumber) {
    throw new Error("TWILIO_FROM_NUMBER not configured")
  }

  const client = twilio(accountSid, authToken)

  try {
    const message = await client.messages.create({
      body: options.body,
      to: options.to,
      from: fromNumber,
    })

    return {
      sid: message.sid,
      status: message.status,
    }
  } catch (error) {
    console.error("[SMS] Failed to send:", error)
    throw error
  }
}
