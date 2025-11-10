import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseConfig } from "./config"

let adminClientInstance: SupabaseClient | null = null

/**
 * Creates a Supabase admin client with service role key
 * Uses singleton pattern to prevent multiple instances
 * Implements backward-compatible URL resolution
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClientInstance) {
    return adminClientInstance
  }

  try {
    const config = getSupabaseConfig()

    if (!config.serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin client. Please set this environment variable.")
    }

    if (config.usedLegacyUrl) {
      console.warn(
        "[Supabase Admin] Initialized with legacy SUPABASE_URL. Please update to NEXT_PUBLIC_SUPABASE_URL for future compatibility.",
      )
    }

    adminClientInstance = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    console.log("[Supabase Admin] Admin client initialized successfully")
    return adminClientInstance
  } catch (error) {
    console.error("[Supabase Admin] Failed to initialize admin client:", error)
    throw error
  }
}

/**
 * Resets the admin client singleton (useful for testing)
 */
export function resetAdminClient(): void {
  adminClientInstance = null
}
