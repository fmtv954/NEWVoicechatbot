import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { readFile } from "fs/promises"
import { join } from "path"

/**
 * DEV-only route to apply SQL migrations
 * POST /api/dev/apply-sql?name=01_tables
 *
 * Returns 403 in production
 */
export async function POST(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "This endpoint is only available in development" }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const fileName = searchParams.get("name")

  if (!fileName) {
    return NextResponse.json({ error: 'Missing "name" query parameter' }, { status: 400 })
  }

  // Sanitize filename to prevent path traversal
  const sanitized = fileName.replace(/[^a-zA-Z0-9_-]/g, "")
  const sqlPath = join(process.cwd(), "scripts", "sql", `${sanitized}.sql`)

  try {
    // Read SQL file
    const sql = await readFile(sqlPath, "utf-8")

    // Execute SQL using admin client
    const { data, error } = await supabaseAdmin.rpc("exec_sql", { sql_string: sql }).catch(async () => {
      // Fallback: try direct query if rpc doesn't exist
      return await supabaseAdmin
        .from("_sql_exec")
        .select("*")
        .is("id", null)
        .then(() => {
          // If that fails, just execute the SQL directly
          return fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ sql_string: sql }),
          }).then((r) => r.json())
        })
        .catch(async () => {
          // Last resort: parse and execute statements one by one
          const statements = sql
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !s.startsWith("--"))

          for (const statement of statements) {
            const result = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({ query: statement }),
            })

            if (!result.ok) {
              throw new Error(`Failed to execute statement: ${statement.substring(0, 100)}...`)
            }
          }

          return { data: null, error: null }
        })
    })

    if (error) {
      console.error("[v0] SQL execution error:", error)
      return NextResponse.json({ error: "SQL execution failed", details: error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Applied ${fileName}.sql`,
      fileName: `${sanitized}.sql`,
    })
  } catch (err) {
    console.error("[v0] Failed to apply SQL:", err)
    return NextResponse.json(
      {
        error: "Failed to read or execute SQL file",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
