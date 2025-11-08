import { NextResponse } from "next/server"

export async function GET() {
  // Check required environment variables and return masked status
  const requiredEnvVars = [
    { key: "OPENAI_API_KEY", present: !!process.env.OPENAI_API_KEY },
    { key: "NEXT_PUBLIC_SUPABASE_URL", present: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
    { key: "SUPABASE_SERVICE_ROLE_KEY", present: !!process.env.SUPABASE_SERVICE_ROLE_KEY },
    { key: "SLACK_WEBHOOK_URL", present: !!process.env.SLACK_WEBHOOK_URL },
    { key: "TAVILY_API_KEY", present: !!process.env.TAVILY_API_KEY },
    { key: "LIVEKIT_API_KEY", present: !!process.env.LIVEKIT_API_KEY },
    { key: "LIVEKIT_API_SECRET", present: !!process.env.LIVEKIT_API_SECRET },
    { key: "LIVEKIT_URL", present: !!process.env.LIVEKIT_URL },
    { key: "JWT_SECRET", present: !!process.env.JWT_SECRET },
  ]

  // Get public base URL
  const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "Not set"

  // Check if we're in production
  const isProduction = process.env.NODE_ENV === "production"

  return NextResponse.json({
    envVars: requiredEnvVars,
    publicBaseUrl,
    isProduction,
  })
}
