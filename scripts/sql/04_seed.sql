-- Insert demo agent
insert into agents (id, name, persona_prompt)
values (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Demo AI Agent',
  'You are a helpful and friendly AI assistant. Your goal is to provide excellent customer service and help users with their inquiries.'
)
on conflict (id) do nothing;

-- Insert demo agent contact
insert into agent_contacts (agent_id, phone_e164, label, is_on_call)
values (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  '+15555551234',
  'Demo Contact',
  true
)
on conflict do nothing;

-- Insert demo campaign
insert into campaigns (id, agent_id, name, allowed_origins)
values (
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'Demo Campaign',
  array['http://localhost:3000', 'https://*.vercel.app']
)
on conflict (id) do nothing;
