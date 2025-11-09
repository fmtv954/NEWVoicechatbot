import { AlertTriangle } from 'lucide-react'

import { LeadTable, type LeadRecord } from './lead-table'
import { Card, CardContent } from '@/components/ui/card'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

type MaybeRelation<T> = T | T[] | null | undefined

interface LeadQueryRow {
  id: string
  created_at: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  reason: string | null
  transcript: string | null
  campaigns?: MaybeRelation<{ id: string; name: string | null }>
  agents?: MaybeRelation<{ id: string; name: string | null }>
}

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

export const dynamic = 'force-dynamic'

async function fetchLeads(): Promise<{ leads: LeadRecord[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select(
        `
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
      )
      .order('created_at', { ascending: false })
      .limit(500)

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

export default async function AdminLeadsPage() {
  const { leads, error } = await fetchLeads()

  return (
    <div className="min-h-screen bg-background p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-muted-foreground text-base">
            Monitor captured leads, review transcripts, and export contact details for follow-up.
          </p>
        </header>

        {error ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-6">
              <AlertTriangle className="text-destructive mt-1 size-5 flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">{error}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Check your Supabase configuration and try again.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <LeadTable initialLeads={leads} />
        )}
      </div>
    </div>
  )
}
