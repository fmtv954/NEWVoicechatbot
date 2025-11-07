-- Enable UUIDs
create extension if not exists "uuid-ossp";

-- Agents table
create table if not exists agents (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  persona_prompt text,
  created_at timestamptz default now()
);

-- Agent contacts table
create table if not exists agent_contacts (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references agents(id),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9]\d{1,14}$'),
  label text,
  is_on_call boolean default true
);

-- Campaigns table
create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references agents(id),
  name text not null,
  allowed_origins text[],
  created_at timestamptz default now()
);

-- Calls table
create table if not exists calls (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid,
  campaign_id uuid,
  started_at timestamptz default now(),
  ended_at timestamptz,
  status text default 'active'
);

-- Call events table
create table if not exists call_events (
  id uuid primary key default uuid_generate_v4(),
  call_id uuid references calls(id),
  type text,
  payload_json jsonb,
  ts timestamptz default now()
);

-- Leads table
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid,
  campaign_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  reason text,
  transcript text,
  created_at timestamptz default now()
);

-- Handoff tickets table
create table if not exists handoff_tickets (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid,
  campaign_id uuid,
  call_id uuid,
  reason text,
  status text check (status in ('pending','accepted','timeout','canceled')),
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz
);

-- SMS messages table
create table if not exists sms_messages (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references handoff_tickets(id),
  to_number text,
  body text,
  provider_message_id text,
  status text,
  created_at timestamptz default now()
);
