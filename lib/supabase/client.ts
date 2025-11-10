"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let clientInstance: SupabaseClient | null = null

/**
 * Creates a Supabase client for browser usage
 * Uses singleton pattern to prevent multiple instances
 */
export function createClient() {
  if (clientInstance) {
    return clientInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)

  return clientInstance
}
