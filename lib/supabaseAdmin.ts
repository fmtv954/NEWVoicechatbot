import { createClient } from "@supabase/supabase-js"

type SupabaseAdminClient = ReturnType<typeof createClient>

let supabaseAdminInstance: SupabaseAdminClient | null = null

function createSupabaseAdmin(): SupabaseAdminClient {
  const supabaseUrl = process.env.SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL environment variable")
  }

  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function getSupabaseAdmin(): SupabaseAdminClient {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createSupabaseAdmin()
  }

  return supabaseAdminInstance
}

/**
 * Supabase Admin Client (Server-only)
 * Uses service role key to bypass RLS policies
 * DO NOT expose this client to the browser
 *
 * This proxy defers client creation until the first property access,
 * ensuring module evaluation never throws if environment variables
 * are not available yet (e.g. during Next.js build analysis).
 */
export const supabaseAdmin: SupabaseAdminClient = new Proxy({} as SupabaseAdminClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseAdmin()
    const value = Reflect.get(client, prop, receiver)
    if (typeof value === "function") {
      return value.bind(client)
    }
    return value
  },
  has(_target, prop) {
    const client = getSupabaseAdmin()
    return Reflect.has(client, prop)
  },
  ownKeys() {
    const client = getSupabaseAdmin()
    return Reflect.ownKeys(client)
  },
  getOwnPropertyDescriptor(_target, prop) {
    const client = getSupabaseAdmin()
    const descriptor = Object.getOwnPropertyDescriptor(client, prop)
    if (descriptor) {
      descriptor.configurable = true
    }
    return descriptor
  },
})

export { getSupabaseAdmin }
