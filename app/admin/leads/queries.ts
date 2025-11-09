import { supabaseAdmin } from "@/lib/supabaseAdmin"

import type { LeadRecord } from "./types"

export async function fetchAdminLeads(limit = 500): Promise<{ leads: LeadRecord[]; error?: string }> {
  try {
    // Fetch leads without joins
    const { data: leadsData, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("id, created_at, first_name, last_name, email, phone, reason, transcript, campaign_id, agent_id")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (leadsError) {
      console.error("[Admin Leads] Failed to load leads:", leadsError)
      return { leads: [], error: "Unable to load leads from Supabase." }
    }

    const leads = leadsData || []

    // Get unique campaign and agent IDs
    const campaignIds = [...new Set(leads.map((l) => l.campaign_id).filter(Boolean))]
    const agentIds = [...new Set(leads.map((l) => l.agent_id).filter(Boolean))]

    // Fetch campaigns
    const { data: campaigns } = await supabaseAdmin.from("campaigns").select("id, name").in("id", campaignIds)

    // Fetch agents
    const { data: agents } = await supabaseAdmin.from("agents").select("id, name").in("id", agentIds)

    // Create lookup maps
    const campaignMap = new Map(campaigns?.map((c) => [c.id, c.name]) || [])
    const agentMap = new Map(agents?.map((a) => [a.id, a.name]) || [])

    // Map to LeadRecord with joined data
    const mappedLeads: LeadRecord[] = leads.map((lead) => ({
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

    return { leads: mappedLeads }
  } catch (error) {
    console.error("[Admin Leads] Unexpected error:", error)
    return { leads: [], error: "Unexpected error while fetching leads." }
  }
}
