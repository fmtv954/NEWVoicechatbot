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
 * Derives Supabase API URL from POSTGRES_URL
 * Example: postgresql://...@db.abc123def.supabase.co:5432/postgres -> https://abc123def.supabase.co
 */
function deriveSupabaseUrlFromPostgres(): string | null {
  const postgresUrl = process.env.POSTGRES_URL
  if (!postgresUrl) return null

  try {
    // Extract project ref from postgres connection string
    // Pattern: postgres://...@db.PROJECT_REF.supabase.co or aws-0-region.pooler.supabase.com
    const match = postgresUrl.match(/db\.([a-z0-9]+)\.supabase\.co/)
    if (match && match[1]) {
      return `https://${match[1]}.supabase.co`
    }

    // Alternative pattern for pooler URLs
    const poolerMatch = postgresUrl.match(/pooler\.supabase\.com/)
    if (poolerMatch) {
      // Try to extract project ref from username or other parts
      const usernameMatch = postgresUrl.match(/postgres:\/\/postgres\.([a-z0-9]+)@/)
      if (usernameMatch && usernameMatch[1]) {
        return `https://${usernameMatch[1]}.supabase.co`
      }
    }
  } catch (error) {
    console.error("[Supabase Config] Failed to derive URL from POSTGRES_URL:", error)
  }

  return null
}

/**
 * Gets Supabase URL with fallback to legacy env var and POSTGRES_URL derivation
 * Priority: NEXT_PUBLIC_SUPABASE_URL > SUPABASE_URL (deprecated) > derived from POSTGRES_URL
 */
export function getSupabaseUrl(): { url: string; isLegacy: boolean; isDerived: boolean } {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const legacyUrl = process.env.SUPABASE_URL

  if (publicUrl) {
    return { url: publicUrl, isLegacy: false, isDerived: false }
  }

  if (legacyUrl) {
    console.warn("[Supabase Config] Using deprecated SUPABASE_URL. Please migrate to NEXT_PUBLIC_SUPABASE_URL")
    return { url: legacyUrl, isLegacy: true, isDerived: false }
  }

  const derivedUrl = deriveSupabaseUrlFromPostgres()
  if (derivedUrl) {
    console.log(
      "[Supabase Config] Derived Supabase URL from POSTGRES_URL:",
      derivedUrl,
      "- Consider setting NEXT_PUBLIC_SUPABASE_URL explicitly",
    )
    return { url: derivedUrl, isLegacy: false, isDerived: true }
  }

  throw new Error(
    "Supabase URL not found. Please set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL, or ensure POSTGRES_URL contains a valid Supabase connection string.",
  )
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
  const postgresUrl = process.env.POSTGRES_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!publicUrl && !legacyUrl && !postgresUrl) {
    errors.push("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL, or POSTGRES_URL")
  }

  if (!publicUrl && legacyUrl) {
    warnings.push("Using deprecated SUPABASE_URL. Migrate to NEXT_PUBLIC_SUPABASE_URL")
  }

  if (!publicUrl && !legacyUrl && postgresUrl) {
    warnings.push(
      "Deriving Supabase URL from POSTGRES_URL. Set NEXT_PUBLIC_SUPABASE_URL explicitly for better performance",
    )
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
