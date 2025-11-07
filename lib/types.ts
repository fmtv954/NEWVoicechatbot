export interface Agent {
  id: string
  name: string
  persona_prompt: string | null
  created_at: string
}

export interface Campaign {
  id: string
  agent_id: string
  name: string
  allowed_origins: string[] | null
  created_at: string
}

export interface Call {
  id: string
  agent_id: string | null
  campaign_id: string | null
  started_at: string
  ended_at: string | null
  status: string
}

export interface Lead {
  id: string
  agent_id: string | null
  campaign_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  reason: string | null
  transcript: string | null
  created_at: string
}

export interface HandoffTicket {
  id: string
  agent_id: string | null
  campaign_id: string | null
  call_id: string | null
  reason: string | null
  status: "pending" | "accepted" | "timeout" | "canceled"
  created_at: string
  expires_at: string
  accepted_at: string | null
}
