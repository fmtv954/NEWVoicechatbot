import { createClient } from "@supabase/supabase-js"

let _supabaseAdmin: ReturnType<typeof createClient> | null = null

/**
 * Get Supabase Admin Client (Server-only)
 * Uses service role key to bypass RLS policies
 * DO NOT expose this client to the browser
 *
 * Lazy initialization ensures env vars are checked at runtime, not at module load time
 */
export function getSupabaseAdmin() {
  if (_supabaseAdmin) {
    return _supabaseAdmin
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL environment variable")
  }

  if (!supabaseKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
  }

  _supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return _supabaseAdmin
}

// Export singleton for backward compatibility
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    return getSupabaseAdmin()[prop as keyof ReturnType<typeof createClient>]
  },
})
