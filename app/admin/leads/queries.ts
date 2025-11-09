import { supabaseAdmin } from '@/lib/supabaseAdmin'

import type { LeadQueryRow, LeadRecord, MaybeRelation } from './types'

function extractRelationName(source: MaybeRelation<{ name: string | null }>): string | null {
  if (!source) {
    return null
  }

  if (Array.isArray(source)) {
    const first = source[0]
    return typeof first?.name === 'string' ? first.name : null
  }

  return typeof source.name === 'string' ? source.name : null
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
  campaigns:campaign_id ( id, name ),
  agents:agent_id ( id, name )
`

export async function fetchAdminLeads(
  limit = 500
): Promise<{ leads: LeadRecord[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select(LEAD_SELECT_FIELDS)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Admin Leads] Failed to load leads:', error)
      return { leads: [], error: 'Unable to load leads from Supabase.' }
    }

    const rows = (data ?? []) as LeadQueryRow[]

    const leads: LeadRecord[] = rows.map((lead) => ({
      id: lead.id,
      createdAt: lead.created_at,
      campaignName: extractRelationName(lead.campaigns),
      agentName: extractRelationName(lead.agents),
      firstName: lead.first_name,
      lastName: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      reason: lead.reason,
      transcript: lead.transcript,
    }))

    return { leads }
  } catch (error) {
    console.error('[Admin Leads] Unexpected error:', error)
    return { leads: [], error: 'Unexpected error while fetching leads.' }
  }
}
