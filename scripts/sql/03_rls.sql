-- Enable RLS on all tables
alter table agents enable row level security;
alter table agent_contacts enable row level security;
alter table campaigns enable row level security;
alter table calls enable row level security;
alter table call_events enable row level security;
alter table leads enable row level security;
alter table handoff_tickets enable row level security;
alter table sms_messages enable row level security;

-- Dev policy: Allow service role (server-side) full access
-- This allows server-side inserts/updates using the service role key

create policy "Allow service role full access on agents"
on agents
for all
to service_role
using (true)
with check (true);

create policy "Allow service role full access on agent_contacts"
on agent_contacts
for all
to service_role
using (true)
with check (true);

create policy "Allow service role full access on campaigns"
on campaigns
for all
to service_role
using (true)
with check (true);

create policy "Allow service role full access on calls"
on calls
for all
to service_role
using (true)
with check (true);

create policy "Allow service role full access on call_events"
on call_events
for all
to service_role
using (true)
with check (true);

create policy "Allow service role full access on leads"
on leads
for all
to service_role
using (true)
with check (true);

create policy "Allow service role full access on handoff_tickets"
on handoff_tickets
for all
to service_role
using (true)
with check (true);

create policy "Allow service role full access on sms_messages"
on sms_messages
for all
to service_role
using (true)
with check (true);
