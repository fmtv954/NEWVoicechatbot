import { supabaseAdmin } from "@/lib/supabaseAdmin"

import type { LeadRecord, MaybeRelation } from "./types"

function extractRelationName(source: MaybeRelation<{ name: string | null }>): string | null {
  if (!source) {
    return null
  }

  if (Array.isArray(source)) {
    const first = source[0]
    return typeof first?.name === "string" ? first.name : null
  }

  return typeof source.name === "string" ? source.name : null
}

const LEAD_SELECT_FIELDS = `
  id,
  created_at,
  first_name,
  last_name,
  email,
  phone,
  reason,
  transcript,
  campaign_id,
  agent_id
`

export async function fetchAdminLeads(limit = 500): Promise<{ leads: LeadRecord[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select(LEAD_SELECT_FIELDS)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[Admin Leads] Failed to load leads:", error)
      return { leads: [], error: "Unable to load leads from Supabase." }
    }

    const rows = (data ?? []) as any[]

    const campaignIds = [...new Set(rows.map((r) => r.campaign_id).filter(Boolean))]
    const agentIds = [...new Set(rows.map((r) => r.agent_id).filter(Boolean))]

    const campaignMap = new Map<string, string>()
    const agentMap = new Map<string, string>()

    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabaseAdmin.from("campaigns").select("id, name").in("id", campaignIds)

      campaigns?.forEach((c) => campaignMap.set(c.id, c.name))
    }

    if (agentIds.length > 0) {
      const { data: agents } = await supabaseAdmin.from("agents").select("id, name").in("id", agentIds)

      agents?.forEach((a) => agentMap.set(a.id, a.name))
    }

    const leads: LeadRecord[] = rows.map((lead) => ({
      id: lead.id,
      createdAt: lead.created_at,
      campaignName: lead.campaign_id ? campaignMap.get(lead.campaign_id) || null : null,
      agentName: lead.agent_id ? agentMap.get(lead.agent_id) || null : null,
      firstName: lead.first_name,
      lastName: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      reason: lead.reason,
      transcript: lead.transcript,
    }))

    return { leads }
  } catch (error) {
    console.error("[Admin Leads] Unexpected error:", error)
    return { leads: [], error: "Unexpected error while fetching leads." }
  }
}
