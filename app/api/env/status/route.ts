import { NextResponse } from "next/server"
import { validateSupabaseEnv, getSupabaseConfig } from "@/lib/supabase/config"

/**
 * Environment status endpoint
 * Returns status of Supabase environment variables
 * Dev-mode only for security
 */
export async function GET() {
  // Security check: only allow in development or when explicitly enabled
  const isDevEnabled = process.env.ADMIN_DEV_ENABLED === "true"
  const isDevelopment = process.env.NODE_ENV === "development"

  if (!isDevelopment && !isDevEnabled) {
    return NextResponse.json({ error: "This endpoint is only available in development mode" }, { status: 403 })
  }

  try {
    const validation = validateSupabaseEnv()

    let config = null
    try {
      config = getSupabaseConfig()
    } catch (error) {
      // Config might not be available if validation failed
    }

    return NextResponse.json({
      status: validation.valid ? "ok" : "error",
      timestamp: new Date().toISOString(),
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✓ Set" : "✗ Missing",
        SUPABASE_URL: process.env.SUPABASE_URL ? "✓ Set (deprecated)" : "✗ Not set",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✓ Set" : "✗ Missing",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? "✓ Set (deprecated)" : "✗ Not set",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓ Set" : "✗ Missing",
      },
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
      },
      config: config
        ? {
            url: config.url.substring(0, 30) + "...", // Partial URL for security
            hasServiceRoleKey: !!config.serviceRoleKey,
            usedLegacyUrl: config.usedLegacyUrl,
          }
        : null,
    })
  } catch (error) {
    console.error("[Env Status API] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to check environment status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
