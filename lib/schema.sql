-- ── SUPABASE SCHEMA FOR AI RECEPTIONIST ─────────────────────────────────────
-- Paste this entire file into Supabase SQL Editor and click Run

-- BUSINESSES: one row per paying plumber/HVAC client
create table if not exists businesses (
  id                    uuid default gen_random_uuid() primary key,
  created_at            timestamptz default now(),
  name                  text not null,
  phone                 text,
  email                 text,
  address               text,
  city                  text,
  province              text default 'ON',
  services              text[],
  hours                 text,
  emergency_available   boolean default false,
  emergency_phone       text,
  calcom_username       text,
  greeting              text,
  stripe_customer_id    text,
  stripe_subscription_id text,
  plan                  text default 'starter',
  active                boolean default true,
  widget_color          text default '#2563eb',
  widget_position       text default 'bottom-right',
  slug                  text unique
);

-- LEADS: every person who contacts through the widget or phone
create table if not exists leads (
  id               uuid default gen_random_uuid() primary key,
  created_at       timestamptz default now(),
  business_id      uuid references businesses(id) on delete cascade,
  name             text,
  phone            text,
  email            text,
  service_needed   text,
  urgency          text default 'normal',
  channel          text default 'chat',
  status           text default 'new',
  notes            text,
  appointment_id   text,
  appointment_time timestamptz
);

-- CONVERSATIONS: full message history per lead
create table if not exists conversations (
  id          uuid default gen_random_uuid() primary key,
  created_at  timestamptz default now(),
  lead_id     uuid references leads(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  role        text not null,
  content     text not null,
  channel     text default 'chat'
);

-- ROW LEVEL SECURITY
alter table businesses enable row level security;
alter table leads enable row level security;
alter table conversations enable row level security;

-- PUBLIC POLICIES (for widget access)
create policy "Public read active businesses" on businesses
  for select using (active = true);

create policy "Public insert leads" on leads
  for insert with check (true);

create policy "Public insert conversations" on conversations
  for insert with check (true);

create policy "Service read leads" on leads
  for select using (true);

create policy "Service read conversations" on conversations
  for select using (true);

create policy "Service update leads" on leads
  for update using (true);

-- INDEXES
create index if not exists leads_business_id_idx on leads(business_id);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_created_at_idx on leads(created_at desc);
create index if not exists conversations_lead_id_idx on conversations(lead_id);
create index if not exists businesses_slug_idx on businesses(slug);

-- SAMPLE BUSINESS (for testing your demo)
insert into businesses (
  name, phone, email, city, province,
  services, hours, emergency_available, emergency_phone,
  greeting, slug, widget_color, active
) values (
  'Hamilton Plumbing Pro',
  '905-555-0100',
  'owner@hamiltonplumbing.ca',
  'Hamilton',
  'ON',
  ARRAY['drain cleaning','water heater repair','pipe repair','emergency plumbing','bathroom renovation'],
  'Monday to Friday 8am to 6pm, Saturday 9am to 2pm',
  true,
  '905-555-0199',
  'Hi! I am the AI receptionist for Hamilton Plumbing Pro. I can help you book an appointment, answer questions about our services, or connect you with our emergency line. How can I help you today?',
  'hamilton-plumbing-pro',
  '#1d4ed8',
  true
) on conflict (slug) do nothing;
