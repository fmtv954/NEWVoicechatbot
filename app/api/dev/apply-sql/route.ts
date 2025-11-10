import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * SQL execution endpoint for development
 * Executes SQL scripts against Supabase database
 * Dev-mode only for security
 */
export async function POST(request: NextRequest) {
  // Security check: only allow in development or when explicitly enabled
  const isDevEnabled = process.env.ADMIN_DEV_ENABLED === "true"
  const isDevelopment = process.env.NODE_ENV === "development"

  if (!isDevelopment && !isDevEnabled) {
    return NextResponse.json({ error: "This endpoint is only available in development mode" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { sql } = body

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "SQL query is required and must be a string" }, { status: 400 })
    }

    console.log("[Apply SQL API] Executing SQL script...")

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql })

    if (error) {
      console.error("[Apply SQL API] SQL execution error:", error)
      return NextResponse.json(
        {
          error: "SQL execution failed",
          details: error.message,
          hint: error.hint,
          code: error.code,
        },
        { status: 400 },
      )
    }

    console.log("[Apply SQL API] SQL executed successfully")

    return NextResponse.json({
      success: true,
      data,
      message: "SQL executed successfully",
    })
  } catch (error) {
    console.error("[Apply SQL API] Unexpected error:", error)

    // Provide structured error response
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const isConfigError = errorMessage.includes("environment variable")

    return NextResponse.json(
      {
        error: "Failed to execute SQL",
        details: errorMessage,
        type: isConfigError ? "configuration_error" : "execution_error",
        hint: isConfigError
          ? "Check your Supabase environment variables. Use /api/env/status to diagnose."
          : "Check SQL syntax and database permissions.",
      },
      { status: isConfigError ? 503 : 500 },
    )
  }
}
