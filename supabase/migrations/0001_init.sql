-- BORA, Vamos em Frente · esquema inicial da campanha
-- Rodar no SQL Editor do Supabase ou com a CLI (supabase db push).
-- Todas as tabelas ficam com RLS ligado e sem políticas públicas: só o servidor (service role) lê e grava.

create extension if not exists pgcrypto;

create table if not exists states (
  uf text primary key,
  name text not null,
  whatsapp_url text,
  created_at timestamptz not null default now()
);

insert into states (uf, name) values
  ('AC','Acre'),('AL','Alagoas'),('AM','Amazonas'),('AP','Amapá'),('BA','Bahia'),('CE','Ceará'),('DF','Distrito Federal'),
  ('ES','Espírito Santo'),('GO','Goiás'),('MA','Maranhão'),('MG','Minas Gerais'),('MS','Mato Grosso do Sul'),('MT','Mato Grosso'),
  ('PA','Pará'),('PB','Paraíba'),('PE','Pernambuco'),('PI','Piauí'),('PR','Paraná'),('RJ','Rio de Janeiro'),('RN','Rio Grande do Norte'),
  ('RO','Rondônia'),('RR','Roraima'),('RS','Rio Grande do Sul'),('SC','Santa Catarina'),('SE','Sergipe'),('SP','São Paulo'),('TO','Tocantins')
on conflict (uf) do nothing;

create table if not exists cities (
  slug text primary key,
  name text not null,
  uf text not null references states(uf),
  ibge text,
  lat double precision not null,
  lng double precision not null,
  approx_location boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists cities_uf_idx on cities (uf);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  cep text not null,
  city_slug text not null references cities(slug),
  city text not null,
  state text not null,
  referral_code text not null unique,
  referred_by text references leads(referral_code),
  privacy_consent boolean not null default false,
  marketing_consent boolean not null default false,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  first_touch jsonb,
  last_touch jsonb,
  experiment jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);
create unique index if not exists leads_email_key on leads (lower(email));
create unique index if not exists leads_phone_key on leads (phone);
create index if not exists leads_city_idx on leads (city_slug);
create index if not exists leads_referred_by_idx on leads (referred_by);
create index if not exists leads_created_idx on leads (created_at desc);

create table if not exists referral_clicks (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null,
  owner_lead_id uuid references leads(id),
  ip_hash text,
  user_agent text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  created_at timestamptz not null default now()
);
create index if not exists referral_clicks_code_idx on referral_clicks (referral_code);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lead_id uuid references leads(id),
  props jsonb not null default '{}'::jsonb,
  path text,
  referral_code text,
  session_id text,
  ip_hash text,
  user_agent text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  created_at timestamptz not null default now()
);
create index if not exists events_name_idx on events (name, created_at desc);
create index if not exists events_lead_idx on events (lead_id);

create table if not exists founder_status (
  lead_id uuid primary key references leads(id),
  city_slug text not null references cities(slug),
  founder_number int not null,
  status text not null default 'active', -- active | cancelled | pending
  provider text,
  provider_ref text,
  amount numeric(10,2),
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  unique (city_slug, founder_number)
);

create table if not exists qualification_answers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);
create index if not exists qualification_lead_idx on qualification_answers (lead_id);

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  text text not null,
  photo_url text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Agregados usados pela LP
create or replace view city_stats as
select c.slug, c.name, c.uf, c.lat, c.lng, c.approx_location,
  (select count(*) from leads l where l.city_slug = c.slug) as leads,
  (select count(*) from founder_status f where f.city_slug = c.slug and f.status = 'active') as founders
from cities c;

create or replace view national_stats as
select count(*) as leads, count(distinct city_slug) as cities, count(distinct state) as states from leads;

-- Rede de indicação de um código: diretos (profundidade 1) e todos os níveis
create or replace function referral_network(code text)
returns json language sql stable as $$
  with recursive net as (
    select referral_code, 1 as depth from leads where referred_by = code
    union all
    select l.referral_code, n.depth + 1 from leads l join net n on l.referred_by = n.referral_code where n.depth < 20
  )
  select json_build_object(
    'signups', (select count(*) from net where depth = 1),
    'network', (select count(*) from net)
  );
$$;

alter table states enable row level security;
alter table cities enable row level security;
alter table leads enable row level security;
alter table referral_clicks enable row level security;
alter table events enable row level security;
alter table founder_status enable row level security;
alter table qualification_answers enable row level security;
alter table testimonials enable row level security;
