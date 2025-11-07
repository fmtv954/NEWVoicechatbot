-- Index for handoff tickets by status and created date
create index if not exists idx_handoff_status on handoff_tickets(status, created_at);

-- Index for SMS messages by ticket ID
create index if not exists idx_sms_ticket on sms_messages(ticket_id);

-- Index for calls by campaign
create index if not exists idx_calls_campaign on calls(campaign_id);

-- Index for calls by agent
create index if not exists idx_calls_agent on calls(agent_id);

-- Index for call events by call
create index if not exists idx_call_events_call on call_events(call_id);

-- Index for leads by campaign
create index if not exists idx_leads_campaign on leads(campaign_id);

-- Index for agent contacts by agent
create index if not exists idx_agent_contacts_agent on agent_contacts(agent_id);
