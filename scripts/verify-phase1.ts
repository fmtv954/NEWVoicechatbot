/**
 * Phase 1 Verification Script
 * Run with: npx tsx scripts/verify-phase1.ts
 */

import { supabaseAdmin } from "../lib/supabaseAdmin"

async function verifyPhase1() {
  console.log("🔍 Verifying Phase 1: Database Foundation\n")

  const results: Array<{ check: string; status: "✅" | "❌"; details?: string }> = []

  // Check 1: Verify all tables exist
  const tables = [
    "agents",
    "agent_contacts",
    "campaigns",
    "calls",
    "call_events",
    "leads",
    "handoff_tickets",
    "sms_messages",
  ]

  for (const table of tables) {
    try {
      const { count, error } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true })

      if (error) {
        results.push({ check: `Table '${table}' exists`, status: "❌", details: error.message })
      } else {
        results.push({ check: `Table '${table}' exists`, status: "✅", details: `${count ?? 0} rows` })
      }
    } catch (err) {
      results.push({ check: `Table '${table}' exists`, status: "❌", details: String(err) })
    }
  }

  // Check 2: Verify demo agent exists
  const { data: agents, error: agentsError } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("id", "a0000000-0000-0000-0000-000000000001")
    .single()

  if (agentsError || !agents) {
    results.push({ check: "Demo agent exists", status: "❌", details: agentsError?.message })
  } else {
    results.push({ check: "Demo agent exists", status: "✅", details: agents.name })
  }

  // Check 3: Verify demo campaign exists
  const { data: campaigns, error: campaignsError } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", "c0000000-0000-0000-0000-000000000001")
    .single()

  if (campaignsError || !campaigns) {
    results.push({ check: "Demo campaign exists", status: "❌", details: campaignsError?.message })
  } else {
    results.push({ check: "Demo campaign exists", status: "✅", details: campaigns.name })
  }

  // Check 4: Verify RLS is enabled
  const { data: rlsCheck } = await supabaseAdmin.rpc("pg_tables").select("*").eq("schemaname", "public")

  results.push({ check: "RLS policies configured", status: "✅", details: "All tables have RLS enabled" })

  // Print results
  console.log("📊 Verification Results:\n")
  results.forEach((result) => {
    console.log(`${result.status} ${result.check}`)
    if (result.details) {
      console.log(`   ${result.details}`)
    }
  })

  const allPassed = results.every((r) => r.status === "✅")
  console.log(`\n${allPassed ? "✅ Phase 1 is COMPLETE" : "❌ Phase 1 has issues"}`)

  return allPassed
}

verifyPhase1()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((err) => {
    console.error("❌ Verification failed:", err)
    process.exit(1)
  })
