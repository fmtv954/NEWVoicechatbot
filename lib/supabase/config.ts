/**
 * Centralized Supabase configuration helper
 * Provides backward-compatible URL resolution
 */

export interface SupabaseConfig {
  url: string
  anonKey: string
  serviceRoleKey?: string
  usedLegacyUrl: boolean
}

/**
 * Gets Supabase URL with fallback to legacy env var
 * Priority: NEXT_PUBLIC_SUPABASE_URL > SUPABASE_URL (deprecated)
 */
export function getSupabaseUrl(): { url: string; isLegacy: boolean } {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const legacyUrl = process.env.SUPABASE_URL

  if (publicUrl) {
    return { url: publicUrl, isLegacy: false }
  }

  if (legacyUrl) {
    console.warn("[Supabase Config] Using deprecated SUPABASE_URL. Please migrate to NEXT_PUBLIC_SUPABASE_URL")
    return { url: legacyUrl, isLegacy: true }
  }

  throw new Error("Supabase URL not found. Please set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL environment variable.")
}

/**
 * Gets complete Supabase configuration for server-side operations
 */
export function getSupabaseConfig(): SupabaseConfig {
  const { url, isLegacy } = getSupabaseUrl()

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!anonKey) {
    throw new Error(
      "Supabase anon key not found. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY environment variable.",
    )
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
    usedLegacyUrl: isLegacy,
  }
}

/**
 * Validates all required Supabase environment variables
 */
export function validateSupabaseEnv(): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const legacyUrl = process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!publicUrl && !legacyUrl) {
    errors.push("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL")
  }

  if (!publicUrl && legacyUrl) {
    warnings.push("Using deprecated SUPABASE_URL. Migrate to NEXT_PUBLIC_SUPABASE_URL")
  }

  if (!anonKey) {
    errors.push("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY")
  }

  if (!serviceRoleKey) {
    warnings.push("Missing SUPABASE_SERVICE_ROLE_KEY (required for admin operations)")
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
