export type MaybeRelation<T> = T | T[] | null | undefined

export interface LeadRecord {
  id: string
  createdAt: string
  campaignName?: string | null
  agentName?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  reason?: string | null
  transcript?: string | null
}

export interface LeadQueryRow {
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
