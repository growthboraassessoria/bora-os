-- 0005 · BORA Builder: sites, conteúdo e SEO, notas e etiquetas; ajustes nas tabelas da LP;
-- funções de cadastro (busca, ficha, criação, edição, anonimização, exportação) e de painel.
-- Regras de cadastro vivem aqui, num lugar só, e valem para o OS e o MCP.

-- ── Tabelas da LP ───────────────────────────────────────────────────────
alter table public.leads add column if not exists site_id text not null default 'vamos-em-frente';
alter table public.leads add column if not exists source text not null default 'lp';
alter table public.leads add column if not exists created_by uuid references auth.users(id);
alter table public.leads add column if not exists updated_at timestamptz;
alter table public.leads add column if not exists updated_by uuid references auth.users(id);
alter table public.leads add column if not exists anonymized_at timestamptz;
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source in ('lp', 'os', 'mcp', 'import'));
create index if not exists leads_site_idx on public.leads (site_id, created_at desc);
create index if not exists leads_state_idx on public.leads (state);
alter table public.events add column if not exists site_id text not null default 'vamos-em-frente';
alter table public.referral_clicks add column if not exists site_id text not null default 'vamos-em-frente';
create index if not exists events_site_created_idx on public.events (site_id, created_at desc);
create index if not exists events_session_idx on public.events (session_id);
create index if not exists referral_clicks_created_idx on public.referral_clicks (created_at desc);

-- Nada da LP é lido pelo navegador: o anon não acessa nada. O OS lê por funções que conferem permissão.
revoke all on all tables in schema public from anon, authenticated;
revoke execute on function public.referral_network(text) from public, anon, authenticated;
grant select (whatsapp_url, uf, name) on public.states to authenticated;
grant update (whatsapp_url) on public.states to authenticated;
grant select on public.cities to authenticated;
grant select, update (approved) on public.testimonials to authenticated;
create policy states_read on public.states for select to authenticated using ((select os.has_perm('builder.dashboard.read')));
create policy states_edit on public.states for update to authenticated using ((select os.has_perm('builder.sites.edit'))) with check ((select os.has_perm('builder.sites.edit')));
create policy cities_read on public.cities for select to authenticated using ((select os.has_perm('builder.dashboard.read')));
create policy testimonials_read on public.testimonials for select to authenticated using ((select os.has_perm('builder.sites.read')));
create policy testimonials_edit on public.testimonials for update to authenticated using ((select os.has_perm('builder.sites.edit'))) with check ((select os.has_perm('builder.sites.edit')));

create trigger leads_audit after insert or update or delete on public.leads for each row execute function os.audit_trigger();
create trigger founder_status_audit after insert or update or delete on public.founder_status for each row execute function os.audit_trigger();
create trigger states_audit after update on public.states for each row execute function os.audit_trigger();
create trigger testimonials_audit after insert or update or delete on public.testimonials for each row execute function os.audit_trigger();

-- ── Schema builder ──────────────────────────────────────────────────────
create schema if not exists builder;
revoke all on schema builder from public, anon;
grant usage on schema builder to authenticated, service_role;
alter default privileges in schema builder revoke execute on functions from public;

create table builder.sites (
  id text primary key,
  name text not null,
  domain text,
  production_url text not null,
  revalidate_url text,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table builder.pages (
  id uuid primary key default gen_random_uuid(),
  site_id text not null references builder.sites(id) on delete cascade,
  route text not null,
  name text not null,
  sort int not null default 0,
  unique (site_id, route)
);

create table builder.page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references builder.pages(id) on delete cascade,
  version int not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  schema_version int not null default 1,
  seo jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  unique (page_id, version)
);
create unique index page_versions_one_published on builder.page_versions (page_id) where status = 'published';
create unique index page_versions_one_draft on builder.page_versions (page_id) where status = 'draft';

create table builder.site_settings (
  site_id text primary key references builder.sites(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table builder.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index lead_notes_lead_idx on builder.lead_notes (lead_id, created_at desc);

create table builder.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create table builder.lead_tags (
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references builder.tags(id) on delete cascade,
  primary key (lead_id, tag_id)
);

insert into builder.sites (id, name, domain, production_url, revalidate_url)
values ('vamos-em-frente', 'BORA, Vamos em Frente', 'lp-bora-campanha-nacional.vercel.app', 'https://lp-bora-campanha-nacional.vercel.app', 'https://lp-bora-campanha-nacional.vercel.app/api/revalidate');
insert into builder.pages (site_id, route, name, sort) values
  ('vamos-em-frente', '/', 'Página inicial', 10),
  ('vamos-em-frente', '/obrigado', 'Obrigado', 20),
  ('vamos-em-frente', '/ranking', 'Ranking', 30),
  ('vamos-em-frente', '/cidade/[slug]', 'Página de cidade', 40),
  ('vamos-em-frente', '/fundador', 'Aluno Fundador', 50),
  ('vamos-em-frente', '/privacidade', 'Privacidade', 60),
  ('vamos-em-frente', '/termos', 'Termos', 70);
insert into builder.site_settings (site_id, settings) values ('vamos-em-frente', '{"city_goal": 500, "founder_slots": 50, "experiment_hero": {"enabled": true, "winner": null}}');

create trigger sites_touch before update on builder.sites for each row execute function os.touch_updated_at();
create trigger sites_audit after insert or update or delete on builder.sites for each row execute function os.audit_trigger();
create trigger page_versions_audit after insert or update or delete on builder.page_versions for each row execute function os.audit_trigger();
create trigger site_settings_audit after insert or update on builder.site_settings for each row execute function os.audit_trigger();
create trigger lead_notes_audit after insert or delete on builder.lead_notes for each row execute function os.audit_trigger();
create trigger lead_tags_audit after insert or delete on builder.lead_tags for each row execute function os.audit_trigger();

alter table builder.sites enable row level security;
alter table builder.pages enable row level security;
alter table builder.page_versions enable row level security;
alter table builder.site_settings enable row level security;
alter table builder.lead_notes enable row level security;
alter table builder.tags enable row level security;
alter table builder.lead_tags enable row level security;

create policy sites_read on builder.sites for select to authenticated using ((select os.has_perm('builder.sites.read')) or (select os.has_perm('builder.dashboard.read')));
create policy sites_edit on builder.sites for update to authenticated using ((select os.has_perm('builder.sites.edit'))) with check ((select os.has_perm('builder.sites.edit')));
create policy pages_read on builder.pages for select to authenticated using ((select os.has_perm('builder.sites.read')));
create policy versions_read on builder.page_versions for select to authenticated using ((select os.has_perm('builder.sites.read')));
create policy settings_read on builder.site_settings for select to authenticated using ((select os.has_perm('builder.sites.read')));
create policy tags_read on builder.tags for select to authenticated using ((select os.has_perm('builder.leads.read')));

grant select on builder.sites, builder.pages, builder.page_versions, builder.site_settings, builder.tags to authenticated;
grant update (name, domain, production_url, revalidate_url, status) on builder.sites to authenticated;
grant all on all tables in schema builder to service_role;

-- ── Utilitários ─────────────────────────────────────────────────────────
create or replace function builder.mask_email(e text) returns text language sql immutable set search_path = '' as $$
  select case when e is null or position('@' in e) = 0 then e
    else left(e, 1) || '•••@' || split_part(e, '@', 2) end $$;
create or replace function builder.mask_phone(p text) returns text language sql immutable set search_path = '' as $$
  select case when p is null or length(p) < 10 then p
    else '(' || substr(p, 1, 2) || ') ' || substr(p, 3, 1) || '••••-••' || right(p, 2) end $$;
create or replace function builder.mask_cpf(c text) returns text language sql immutable set search_path = '' as $$
  select case when c is null then null else '•••.•••.•••-' || right(c, 2) end $$;
create or replace function builder.clean_phone(v text) returns text language sql immutable set search_path = '' as $$
  select case when d like '55%' and length(d) > 11 then substr(d, 3) else d end
  from (select regexp_replace(coalesce(v, ''), '\D', '', 'g') as d) x $$;

create or replace function builder.make_code(first_name text) returns text
language plpgsql volatile set search_path = '' as $$
declare base text; code text; i int := 0;
begin
  base := upper(left(regexp_replace(translate(coalesce(first_name, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇñÑ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUCnN'), '[^A-Za-z]', '', 'g'), 8));
  if length(base) < 2 then base := 'BORA'; end if;
  loop
    code := base || (100 + floor(random() * 900))::int::text;
    exit when not exists (select 1 from public.leads where referral_code = code);
    i := i + 1;
    if i > 50 then raise exception 'codigo_indisponivel'; end if;
  end loop;
  return code;
end $$;

-- Linha pública de um cadastro, com dado pessoal mascarado ou não.
create or replace function builder._lead_json(l public.leads, show_pii boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id, 'bora_number', l.bora_number, 'first_name', l.first_name, 'last_name', l.last_name,
    'email', case when show_pii then l.email else builder.mask_email(l.email) end,
    'phone', case when show_pii then l.phone else builder.mask_phone(l.phone) end,
    'cpf', case when show_pii then l.cpf else builder.mask_cpf(l.cpf) end,
    'birth_date', case when show_pii then l.birth_date::text when l.birth_date is null then null else '••/••/••••' end,
    'pii_masked', not show_pii,
    'sex', l.sex, 'cep', l.cep, 'city_slug', l.city_slug, 'city', l.city, 'state', l.state,
    'referral_code', l.referral_code, 'referred_by', l.referred_by,
    'privacy_consent', l.privacy_consent, 'marketing_consent', l.marketing_consent,
    'utm', jsonb_build_object('source', l.utm_source, 'medium', l.utm_medium, 'campaign', l.utm_campaign, 'content', l.utm_content, 'term', l.utm_term),
    'first_touch', l.first_touch, 'last_touch', l.last_touch, 'experiment', l.experiment, 'external_ids', l.external_ids,
    'site_id', l.site_id, 'source', l.source, 'created_at', l.created_at, 'updated_at', l.updated_at, 'anonymized_at', l.anonymized_at);
$$;

-- ── Busca ───────────────────────────────────────────────────────────────
create or replace function builder._search_leads(ctx jsonb, f jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := nullif(trim(coalesce(f->>'q', '')), '');
  qd text := regexp_replace(coalesce(f->>'q', ''), '\D', '', 'g');
  pii boolean := os.ctx_has(ctx, 'builder.leads.pii');
  lim int := least(greatest(coalesce((f->>'limit')::int, 50), 1), 500);
  off int := greatest(coalesce((f->>'offset')::int, 0), 0);
  sort text := coalesce(f->>'sort', 'created_at');
  dir text := case when f->>'dir' = 'asc' then 'asc' else 'desc' end;
  total int; rows jsonb;
begin
  perform os.require(ctx, 'builder.leads.read');
  if q is not null and (position('@' in q) > 0 or length(qd) >= 8) and not pii then
    raise exception 'sem_permissao: builder.leads.pii' using errcode = '42501';
  end if;
  if sort not in ('created_at', 'bora_number', 'first_name', 'city', 'state') then sort := 'created_at'; end if;

  create temp table if not exists _hits (id uuid primary key) on commit drop;
  truncate _hits;
  insert into _hits
  select l.id from public.leads l
  where os.ctx_in_scope(ctx, l.state, l.site_id)
    and (f->>'site_id' is null or l.site_id = f->>'site_id')
    and (f->>'uf' is null or l.state = f->>'uf')
    and (f->>'city_slug' is null or l.city_slug = f->>'city_slug')
    and (f->>'source' is null or l.utm_source = f->>'source' or (f->>'source' = '(direto)' and l.utm_source is null))
    and (f->>'origin' is null or l.source = f->>'origin')
    and (f->>'referred' is null or (f->>'referred')::boolean = (l.referred_by is not null))
    and (f->>'marketing' is null or (f->>'marketing')::boolean = l.marketing_consent)
    and (f->>'from' is null or l.created_at >= (f->>'from')::timestamptz)
    and (f->>'to' is null or l.created_at < (f->>'to')::timestamptz)
    and (f->>'answered' is null or (f->>'answered')::boolean = exists (select 1 from public.qualification_answers a where a.lead_id = l.id))
    and (f->>'founder' is null or (f->>'founder')::boolean = exists (select 1 from public.founder_status fs where fs.lead_id = l.id and fs.status = 'active'))
    and (f->>'tag' is null or exists (select 1 from builder.lead_tags lt join builder.tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.name = f->>'tag'))
    and (q is null
      or (l.first_name || ' ' || l.last_name) ilike '%' || q || '%'
      or l.referral_code ilike q || '%'
      or l.city ilike q || '%'
      or ltrim(q, '#') ~ '^\d{1,7}$' and l.bora_number = ltrim(q, '#')::int
      or (pii and (lower(l.email) = lower(q) or l.email ilike q || '%' or (length(qd) >= 8 and (l.phone like '%' || qd || '%' or l.cpf = qd)))));
  select count(*) into total from _hits;

  execute format($f$
    select coalesce(jsonb_agg(j order by rn), '[]'::jsonb) from (
      select builder._lead_json(l, $1) || jsonb_build_object(
        'direct', (select count(*) from public.leads x where x.referred_by = l.referral_code),
        'answered', exists (select 1 from public.qualification_answers a where a.lead_id = l.id),
        'founder', exists (select 1 from public.founder_status fs where fs.lead_id = l.id and fs.status = 'active'),
        'tags', coalesce((select jsonb_agg(t.name order by t.name) from builder.lead_tags lt join builder.tags t on t.id = lt.tag_id where lt.lead_id = l.id), '[]'::jsonb)) as j,
        row_number() over (order by l.%I %s, l.id) as rn
      from public.leads l join _hits h on h.id = l.id
      order by l.%I %s, l.id limit $2 offset $3) s $f$, sort, dir, sort, dir)
  into rows using pii, lim, off;

  return jsonb_build_object('total', total, 'rows', rows, 'pii', pii);
end $$;

-- ── Ficha ───────────────────────────────────────────────────────────────
create or replace function builder._get_lead(ctx jsonb, p_id uuid, p_reveal boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.leads; show boolean; referrer jsonb; v_out jsonb;
begin
  perform os.require(ctx, 'builder.leads.read');
  select * into l from public.leads where id = p_id;
  if not found or not os.ctx_in_scope(ctx, l.state, l.site_id) then return null; end if;
  show := p_reveal and os.ctx_has(ctx, 'builder.leads.pii');
  if p_reveal then
    perform os.require(ctx, 'builder.leads.pii');
    perform os.write_audit('pii.revealed', 'public.leads', l.id::text, null, null, jsonb_build_object('bora_number', l.bora_number));
  end if;
  select jsonb_build_object('id', r.id, 'bora_number', r.bora_number, 'name', r.first_name || ' ' || r.last_name, 'city', r.city, 'state', r.state)
    into referrer from public.leads r where r.referral_code = l.referred_by;
  v_out := builder._lead_json(l, show) || jsonb_build_object(
    'can_reveal', os.ctx_has(ctx, 'builder.leads.pii'),
    'referrer', referrer,
    'network', public.referral_network(l.referral_code),
    'referral_clicks', (select count(*) from public.referral_clicks c where c.referral_code = l.referral_code),
    'referred', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'bora_number', x.bora_number, 'name', x.first_name || ' ' || x.last_name, 'city', x.city, 'state', x.state, 'created_at', x.created_at) order by x.created_at desc)
      from public.leads x where x.referred_by = l.referral_code), '[]'::jsonb),
    'answers', coalesce((select jsonb_object_agg(a.question, a.answer) from public.qualification_answers a where a.lead_id = l.id), '{}'::jsonb),
    'founder', (select to_jsonb(fs) - 'lead_id' from public.founder_status fs where fs.lead_id = l.id),
    'events', coalesce((select jsonb_agg(jsonb_build_object('name', e.name, 'at', e.created_at, 'path', e.path, 'props', e.props) order by e.created_at desc)
      from (select * from public.events e where e.lead_id = l.id order by e.created_at desc limit 100) e), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'at', n.created_at, 'author', m.full_name) order by n.created_at desc)
      from builder.lead_notes n left join os.members m on m.user_id = n.created_by where n.lead_id = l.id), '[]'::jsonb),
    'tags', coalesce((select jsonb_agg(t.name order by t.name) from builder.lead_tags lt join builder.tags t on t.id = lt.tag_id where lt.lead_id = l.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('at', a.at, 'action', a.action, 'actor_type', a.actor_type, 'actor', coalesce(m.full_name, a.actor_type), 'before', a.before, 'after', a.after) order by a.at desc)
      from (select * from os.audit_log a where a.entity = 'public.leads' and a.entity_id = l.id::text order by a.at desc limit 50) a
      left join os.members m on m.user_id::text = a.actor_id), '[]'::jsonb));
  return v_out;
end $$;

-- ── Criação ─────────────────────────────────────────────────────────────
create or replace function builder._create_lead(ctx jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_phone text := builder.clean_phone(p->>'phone');
  v_email text := lower(trim(coalesce(p->>'email', '')));
  v_cpf text := nullif(regexp_replace(coalesce(p->>'cpf', ''), '\D', '', 'g'), '');
  v_uf text := upper(trim(coalesce(p->>'state', '')));
  v_slug text := nullif(trim(coalesce(p->>'city_slug', '')), '');
  v_ref text := nullif(upper(trim(coalesce(p->>'referred_by', ''))), '');
  existing public.leads; l public.leads;
  src text := case when ctx->>'actor_type' = 'mcp' then 'mcp' else 'os' end;
begin
  perform os.require(ctx, 'builder.leads.create');
  if length(trim(coalesce(p->>'first_name', ''))) < 1 or length(trim(coalesce(p->>'last_name', ''))) < 1 then raise exception 'invalido: nome'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'invalido: email'; end if;
  if length(v_phone) not between 10 and 11 then raise exception 'invalido: telefone'; end if;
  if regexp_replace(coalesce(p->>'cep', ''), '\D', '', 'g') !~ '^\d{8}$' then raise exception 'invalido: cep'; end if;
  if v_cpf is not null and v_cpf !~ '^\d{11}$' then raise exception 'invalido: cpf'; end if;
  if not os.ctx_in_scope(ctx, v_uf, coalesce(p->>'site_id', 'vamos-em-frente')) then raise exception 'sem_permissao: escopo' using errcode = '42501'; end if;
  if v_ref is not null and not exists (select 1 from public.leads x where x.referral_code = v_ref) then raise exception 'invalido: codigo_indicador'; end if;

  select * into existing from public.leads x where x.phone = v_phone or lower(x.email) = v_email or (v_cpf is not null and x.cpf = v_cpf) limit 1;
  if found then return jsonb_build_object('created', false, 'id', existing.id, 'bora_number', existing.bora_number); end if;

  if v_slug is null or not exists (select 1 from public.cities c where c.slug = v_slug) then
    if p->>'lat' is null then raise exception 'invalido: cidade'; end if;
    v_slug := coalesce(v_slug, lower(regexp_replace(translate(p->>'city', 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^A-Za-z0-9]+', '-', 'g')) || '-' || lower(v_uf));
    insert into public.cities (slug, name, uf, ibge, lat, lng, approx_location)
    values (v_slug, p->>'city', v_uf, p->>'ibge', (p->>'lat')::float8, (p->>'lng')::float8, coalesce((p->>'approx')::boolean, false))
    on conflict (slug) do nothing;
  end if;

  if ctx->>'actor_type' = 'mcp' then
    perform set_config('bora.actor_type', 'mcp', true);
    perform set_config('bora.actor_id', ctx->>'actor_id', true);
  end if;
  insert into public.leads (first_name, last_name, email, phone, cep, sex, birth_date, cpf, city_slug, city, state, referral_code, referred_by,
    privacy_consent, marketing_consent, utm_source, utm_medium, utm_campaign, site_id, source, created_by)
  values (trim(p->>'first_name'), trim(p->>'last_name'), v_email, v_phone, regexp_replace(p->>'cep', '\D', '', 'g'),
    nullif(p->>'sex', ''), nullif(p->>'birth_date', '')::date, v_cpf, v_slug, (select c.name from public.cities c where c.slug = v_slug), v_uf,
    builder.make_code(p->>'first_name'), v_ref, coalesce((p->>'privacy_consent')::boolean, false), coalesce((p->>'marketing_consent')::boolean, false),
    nullif(p->>'utm_source', ''), nullif(p->>'utm_medium', ''), nullif(p->>'utm_campaign', ''),
    coalesce(p->>'site_id', 'vamos-em-frente'), src, case when ctx->>'actor_type' = 'member' then (ctx->>'actor_id')::uuid end)
  returning * into l;
  return jsonb_build_object('created', true, 'id', l.id, 'bora_number', l.bora_number, 'referral_code', l.referral_code);
end $$;

-- ── Edição ──────────────────────────────────────────────────────────────
create or replace function builder._update_lead(ctx jsonb, p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.leads; k text; pii_keys text[] := array['email', 'phone', 'cpf', 'birth_date'];
  allowed text[] := array['first_name', 'last_name', 'email', 'phone', 'cpf', 'birth_date', 'sex', 'cep', 'marketing_consent'];
begin
  perform os.require(ctx, 'builder.leads.edit');
  select * into l from public.leads where id = p_id for update;
  if not found or not os.ctx_in_scope(ctx, l.state, l.site_id) then raise exception 'nao_encontrado'; end if;
  if l.anonymized_at is not null then raise exception 'cadastro_anonimizado'; end if;
  for k in select jsonb_object_keys(p) loop
    if not k = any(allowed) then raise exception 'invalido: campo %', k; end if;
    if k = any(pii_keys) then perform os.require(ctx, 'builder.leads.pii'); end if;
  end loop;
  if p ? 'email' and lower(trim(p->>'email')) !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'invalido: email'; end if;
  if p ? 'phone' and length(builder.clean_phone(p->>'phone')) not between 10 and 11 then raise exception 'invalido: telefone'; end if;
  if p ? 'cpf' and nullif(regexp_replace(p->>'cpf', '\D', '', 'g'), '') !~ '^\d{11}$' then raise exception 'invalido: cpf'; end if;
  if p ? 'sex' and nullif(p->>'sex', '') is not null and p->>'sex' not in ('F', 'M', 'N') then raise exception 'invalido: sexo'; end if;

  if ctx->>'actor_type' = 'mcp' then
    perform set_config('bora.actor_type', 'mcp', true);
    perform set_config('bora.actor_id', ctx->>'actor_id', true);
  end if;
  update public.leads set
    first_name = case when p ? 'first_name' then trim(p->>'first_name') else first_name end,
    last_name = case when p ? 'last_name' then trim(p->>'last_name') else last_name end,
    email = case when p ? 'email' then lower(trim(p->>'email')) else email end,
    phone = case when p ? 'phone' then builder.clean_phone(p->>'phone') else phone end,
    cpf = case when p ? 'cpf' then nullif(regexp_replace(p->>'cpf', '\D', '', 'g'), '') else cpf end,
    birth_date = case when p ? 'birth_date' then nullif(p->>'birth_date', '')::date else birth_date end,
    sex = case when p ? 'sex' then nullif(p->>'sex', '') else sex end,
    cep = case when p ? 'cep' then regexp_replace(p->>'cep', '\D', '', 'g') else cep end,
    marketing_consent = case when p ? 'marketing_consent' then (p->>'marketing_consent')::boolean else marketing_consent end,
    updated_at = now(),
    updated_by = case when ctx->>'actor_type' = 'member' then (ctx->>'actor_id')::uuid else updated_by end
  where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ── Anonimização (LGPD) ─────────────────────────────────────────────────
create or replace function builder._anonymize_lead(ctx jsonb, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.leads;
begin
  perform os.require(ctx, 'builder.leads.anonymize');
  select * into l from public.leads where id = p_id for update;
  if not found or not os.ctx_in_scope(ctx, l.state, l.site_id) then raise exception 'nao_encontrado'; end if;
  update public.leads set first_name = 'Anonimizado', last_name = '#' || bora_number, email = 'anonimizado+' || id || '@bora.invalid',
    phone = '00' || lpad(bora_number::text, 9, '0'), cpf = null, birth_date = null, sex = null, ip_hash = null, user_agent = null,
    first_touch = null, last_touch = null, marketing_consent = false, anonymized_at = now(), updated_at = now(),
    updated_by = case when ctx->>'actor_type' = 'member' then (ctx->>'actor_id')::uuid end
  where id = p_id;
  update public.events set ip_hash = null, user_agent = null where lead_id = p_id;
  delete from public.qualification_answers where lead_id = p_id and question in ('company', 'club');
  delete from builder.lead_notes where lead_id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ── Exportação ──────────────────────────────────────────────────────────
create or replace function builder._export_leads(ctx jsonb, f jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare res jsonb;
begin
  perform os.require(ctx, 'builder.leads.export');
  res := builder._search_leads(ctx, coalesce(f, '{}'::jsonb) || jsonb_build_object('limit', 500, 'offset', coalesce((f->>'offset')::int, 0)));
  perform os.write_audit('leads.exported', 'public.leads', null, null, null,
    jsonb_build_object('rows', jsonb_array_length(res->'rows'), 'pii', res->'pii', 'filters', coalesce(f, '{}'::jsonb) - 'q'));
  return res;
end $$;

-- ── Notas e etiquetas ───────────────────────────────────────────────────
create or replace function builder._add_note(ctx jsonb, p_lead uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.leads; nid uuid;
begin
  perform os.require(ctx, 'builder.leads.edit');
  select * into l from public.leads where id = p_lead;
  if not found or not os.ctx_in_scope(ctx, l.state, l.site_id) then raise exception 'nao_encontrado'; end if;
  insert into builder.lead_notes (lead_id, body, created_by) values (p_lead, trim(p_body),
    case when ctx->>'actor_type' = 'member' then (ctx->>'actor_id')::uuid end) returning id into nid;
  return jsonb_build_object('id', nid);
end $$;

create or replace function builder._set_tags(ctx jsonb, p_lead uuid, p_tags text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.leads;
begin
  perform os.require(ctx, 'builder.leads.edit');
  select * into l from public.leads where id = p_lead;
  if not found or not os.ctx_in_scope(ctx, l.state, l.site_id) then raise exception 'nao_encontrado'; end if;
  insert into builder.tags (name) select distinct lower(trim(t)) from unnest(p_tags) t where length(trim(t)) between 1 and 40 on conflict (name) do nothing;
  delete from builder.lead_tags lt using builder.tags t where lt.tag_id = t.id and lt.lead_id = p_lead and not (t.name = any(select lower(trim(x)) from unnest(p_tags) x));
  insert into builder.lead_tags (lead_id, tag_id) select p_lead, t.id from builder.tags t where t.name = any(select lower(trim(x)) from unnest(p_tags) x) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ── Painel ──────────────────────────────────────────────────────────────
-- f: site_id, from, to (ISO), uf. Métricas de cadastro respeitam o escopo; as de visita só aparecem sem escopo de UF.
create or replace function builder._dashboard(ctx jsonb, f jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t0 timestamptz := coalesce((f->>'from')::timestamptz, now() - interval '30 days');
  t1 timestamptz := coalesce((f->>'to')::timestamptz, now());
  span interval := t1 - t0;
  site text := f->>'site_id';
  uf text := f->>'uf';
  scoped boolean := ctx->'ufs' is not null and jsonb_typeof(ctx->'ufs') <> 'null';
  can_events boolean := os.ctx_has(ctx, 'builder.analytics.read') and not scoped and uf is null;
  res jsonb;
begin
  perform os.require(ctx, 'builder.dashboard.read');
  with
  l as (select * from public.leads x where os.ctx_in_scope(ctx, x.state, x.site_id) and (site is null or x.site_id = site) and (uf is null or x.state = uf)),
  cur as (select * from l where created_at >= t0 and created_at < t1),
  prev as (select * from l where created_at >= t0 - span and created_at < t0),
  ev as (select * from public.events e where can_events and (site is null or e.site_id = site) and e.created_at >= t0 - span and e.created_at < t1),
  vis as (
    select count(distinct session_id) filter (where name = 'page_view' and created_at >= t0) as v_cur,
           count(distinct session_id) filter (where name = 'page_view' and created_at < t0) as v_prev,
           count(distinct session_id) filter (where name = 'form_started' and created_at >= t0) as started,
           count(*) filter (where name like 'share_%' and created_at >= t0) as shares,
           count(*) filter (where name like 'share_%' and created_at < t0) as shares_prev
    from ev),
  clicks as (select count(*) filter (where c.created_at >= t0) as cur, count(*) filter (where c.created_at < t0) as prev
             from public.referral_clicks c where can_events and (site is null or c.site_id = site) and c.created_at >= t0 - span and c.created_at < t1),
  k as (select count(*) as brought from l x where x.created_at >= t0 and x.referred_by in (select referral_code from cur)),
  days as (select generate_series(date_trunc('day', t0 at time zone 'America/Sao_Paulo'), date_trunc('day', (t1 - interval '1 second') at time zone 'America/Sao_Paulo'), interval '1 day') as d)
  select jsonb_build_object(
    'period', jsonb_build_object('from', t0, 'to', t1),
    'events_visible', can_events,
    'kpis', jsonb_build_object(
      'leads', (select count(*) from cur), 'leads_prev', (select count(*) from prev),
      'referred', (select count(*) from cur where referred_by is not null), 'referred_prev', (select count(*) from prev where referred_by is not null),
      'answered', (select count(*) from cur c where exists (select 1 from public.qualification_answers a where a.lead_id = c.id)),
      'founders', (select count(*) from public.founder_status fs join l on l.id = fs.lead_id where fs.status = 'active'),
      'total_leads', (select count(*) from l),
      'cities', (select count(distinct city_slug) from l), 'states', (select count(distinct state) from l),
      'k_factor', (select case when (select count(*) from cur) = 0 then null else round(brought::numeric / (select count(*) from cur), 2) end from k),
      'visitors', case when can_events then (select v_cur from vis) end, 'visitors_prev', case when can_events then (select v_prev from vis) end,
      'form_started', case when can_events then (select started from vis) end,
      'shares', case when can_events then (select shares from vis) end, 'shares_prev', case when can_events then (select shares_prev from vis) end,
      'ref_clicks', case when can_events then (select cur from clicks) end, 'ref_clicks_prev', case when can_events then (select prev from clicks) end,
      'active_ids', (select count(distinct x.id) from l x where exists (select 1 from public.events e where e.lead_id = x.id and e.created_at > now() - interval '30 days')
                       or exists (select 1 from public.founder_status fs where fs.lead_id = x.id and fs.status = 'active'))),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'),
        'leads', (select count(*) from cur where date_trunc('day', created_at at time zone 'America/Sao_Paulo') = d),
        'referred', (select count(*) from cur where referred_by is not null and date_trunc('day', created_at at time zone 'America/Sao_Paulo') = d),
        'visitors', case when can_events then (select count(distinct session_id) from ev where name = 'page_view' and created_at >= t0 and date_trunc('day', created_at at time zone 'America/Sao_Paulo') = d) end)
        order by d), '[]'::jsonb) from days),
    'funnel', case when can_events then (select jsonb_agg(jsonb_build_object('step', s.step, 'label', s.label, 'n', s.n) order by s.ord) from (
        select 1 as ord, 'page_view' as step, 'Visitou' as label, count(distinct session_id) as n from ev where name = 'page_view' and created_at >= t0
        union all select 2, 'form_started', 'Começou o cadastro', count(distinct session_id) from ev where name = 'form_started' and created_at >= t0
        union all select 3, 'cep_resolved', 'CEP encontrado', count(distinct session_id) from ev where name = 'cep_resolved' and created_at >= t0
        union all select 4, 'form_completed', 'Cadastrou', (select count(*) from cur)
        union all select 5, 'shared', 'Compartilhou', count(distinct session_id) from ev where name like 'share_%' and created_at >= t0
        union all select 6, 'referred', 'Trouxe alguém', (select count(distinct referred_by) from l x where x.created_at >= t0 and x.referred_by in (select referral_code from cur))) s) end,
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', s.source, 'medium', s.medium, 'leads', s.n, 'referred', s.r) order by s.n desc), '[]'::jsonb) from (
        select coalesce(utm_source, '(direto)') as source, coalesce(utm_medium, '—') as medium, count(*) as n, count(*) filter (where referred_by is not null) as r
        from cur group by 1, 2 order by 3 desc limit 12) s),
    'cities', (select coalesce(jsonb_agg(jsonb_build_object('slug', s.city_slug, 'city', s.city, 'uf', s.state, 'leads', s.n, 'total', s.total) order by s.n desc), '[]'::jsonb) from (
        select c.city_slug, c.city, c.state, count(*) as n, (select count(*) from l x where x.city_slug = c.city_slug) as total
        from cur c group by 1, 2, 3 order by 4 desc limit 10) s),
    'experiment', (select coalesce(jsonb_agg(jsonb_build_object('variant', g.v, 'leads', g.n, 'visitors',
          case when can_events then (select count(distinct e.session_id) from ev e where e.name = 'page_view' and e.created_at >= t0 and e.props->>'variant' = g.v) end) order by g.v), '[]'::jsonb)
        from (select coalesce(experiment->>'hero', '?') as v, count(*) as n from cur group by 1) g)
  ) into res;
  return res;
end $$;

-- ── Indicações, origem, cidades, qualificação, eventos ──────────────────
create or replace function builder._referrers(ctx jsonb, f jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb; lim int := least(coalesce((f->>'limit')::int, 50), 200);
begin
  perform os.require(ctx, 'builder.referrals.read');
  select coalesce(jsonb_agg(r order by (r->>'direct')::int desc, (r->>'network')::int desc), '[]'::jsonb) into res from (
    select jsonb_build_object('id', l.id, 'bora_number', l.bora_number, 'name', l.first_name || ' ' || l.last_name, 'city', l.city, 'state', l.state,
      'code', l.referral_code, 'direct', d.direct, 'network', (public.referral_network(l.referral_code)->>'network')::int,
      'clicks', (select count(*) from public.referral_clicks c where c.referral_code = l.referral_code),
      'founders', (select count(*) from public.leads x join public.founder_status fs on fs.lead_id = x.id where x.referred_by = l.referral_code and fs.status = 'active')) as r
    from public.leads l
    join lateral (select count(*)::int as direct from public.leads x where x.referred_by = l.referral_code) d on true
    where d.direct > 0 and os.ctx_in_scope(ctx, l.state, l.site_id) and (f->>'uf' is null or l.state = f->>'uf') and (f->>'site_id' is null or l.site_id = f->>'site_id')
    order by d.direct desc limit lim) s;
  return jsonb_build_object('rows', res,
    'totals', (select jsonb_build_object('leads', count(*), 'referred', count(*) filter (where referred_by is not null),
      'referrers', count(distinct referred_by)) from public.leads l where os.ctx_in_scope(ctx, l.state, l.site_id) and (f->>'uf' is null or l.state = f->>'uf')));
end $$;

create or replace function builder._referral_tree(ctx jsonb, p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform os.require(ctx, 'builder.referrals.read');
  with recursive net as (
    select l.id, l.referral_code, l.referred_by, 0 as depth from public.leads l where l.referral_code = upper(p_code)
    union all
    select l.id, l.referral_code, l.referred_by, n.depth + 1 from public.leads l join net n on l.referred_by = n.referral_code where n.depth < 8)
  select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'bora_number', l.bora_number, 'name', l.first_name || ' ' || left(l.last_name, 1) || '.', 'code', l.referral_code,
    'parent', l.referred_by, 'depth', n.depth, 'city', l.city, 'state', l.state) order by n.depth, l.created_at), '[]'::jsonb)
  into res from net n join public.leads l on l.id = n.id where os.ctx_in_scope(ctx, l.state, l.site_id);
  return res;
end $$;

create or replace function builder._origins(ctx jsonb, f jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t0 timestamptz := coalesce((f->>'from')::timestamptz, now() - interval '30 days');
  t1 timestamptz := coalesce((f->>'to')::timestamptz, now());
  touch text := case when f->>'touch' = 'first' then 'first' else 'last' end;
  scoped boolean := ctx->'ufs' is not null and jsonb_typeof(ctx->'ufs') <> 'null';
  can_events boolean := os.ctx_has(ctx, 'builder.analytics.read') and not scoped;
  res jsonb;
begin
  perform os.require(ctx, 'builder.analytics.read');
  select coalesce(jsonb_agg(r order by (r->>'leads')::int desc), '[]'::jsonb) into res from (
    select jsonb_build_object('source', s.source, 'medium', s.medium, 'campaign', s.campaign, 'content', s.content, 'leads', s.leads, 'referred', s.referred,
      'visitors', case when can_events then (select count(distinct e.session_id) from public.events e where e.name = 'page_view' and e.created_at >= t0 and e.created_at < t1
        and coalesce(e.utm_source, '(direto)') = s.source and coalesce(e.utm_medium, '—') = s.medium and coalesce(e.utm_campaign, '—') = s.campaign) end) as r
    from (
      select
        coalesce(case when touch = 'first' then l.first_touch->>'utm_source' else l.utm_source end, '(direto)') as source,
        coalesce(case when touch = 'first' then l.first_touch->>'utm_medium' else l.utm_medium end, '—') as medium,
        coalesce(case when touch = 'first' then l.first_touch->>'utm_campaign' else l.utm_campaign end, '—') as campaign,
        coalesce(case when touch = 'first' then l.first_touch->>'utm_content' else l.utm_content end, '—') as content,
        count(*)::int as leads, count(*) filter (where l.referred_by is not null)::int as referred
      from public.leads l
      where l.created_at >= t0 and l.created_at < t1 and os.ctx_in_scope(ctx, l.state, l.site_id) and (f->>'site_id' is null or l.site_id = f->>'site_id')
      group by 1, 2, 3, 4) s) x;
  return jsonb_build_object('rows', res, 'touch', touch, 'events_visible', can_events);
end $$;

create or replace function builder._cities(ctx jsonb, f jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare goal int; slots int; res jsonb;
begin
  perform os.require(ctx, 'builder.dashboard.read');
  select coalesce((settings->>'city_goal')::int, 500), coalesce((settings->>'founder_slots')::int, 50) into goal, slots
    from builder.site_settings where site_id = coalesce(f->>'site_id', 'vamos-em-frente');
  goal := coalesce(goal, 500); slots := coalesce(slots, 50);
  select coalesce(jsonb_agg(r order by (r->>'leads')::int desc, r->>'name'), '[]'::jsonb) into res from (
    select jsonb_build_object('slug', c.slug, 'name', c.name, 'uf', c.uf, 'approx', c.approx_location, 'leads', s.leads, 'founders', s.founders,
      'last7', s.last7, 'pct', least(100, round(s.leads * 100.0 / goal)), 'slots_left', greatest(0, slots - s.founders)) as r
    from public.cities c
    join lateral (select count(*)::int as leads, count(*) filter (where l.created_at > now() - interval '7 days')::int as last7,
      (select count(*)::int from public.founder_status fs where fs.city_slug = c.slug and fs.status = 'active') as founders
      from public.leads l where l.city_slug = c.slug and os.ctx_in_scope(ctx, l.state, l.site_id)) s on true
    where os.ctx_in_scope(ctx, c.uf, coalesce(f->>'site_id', 'vamos-em-frente')) and (f->>'uf' is null or c.uf = f->>'uf') and s.leads > 0) x;
  return jsonb_build_object('rows', res, 'goal', goal, 'slots', slots,
    'states', (select coalesce(jsonb_agg(jsonb_build_object('uf', st.uf, 'name', st.name, 'whatsapp_url', st.whatsapp_url,
      'leads', (select count(*) from public.leads l where l.state = st.uf and os.ctx_in_scope(ctx, l.state, l.site_id))) order by st.uf), '[]'::jsonb)
      from public.states st where os.ctx_in_scope(ctx, st.uf, 'vamos-em-frente')));
end $$;

create or replace function builder._qualification(ctx jsonb, f jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform os.require(ctx, 'builder.analytics.read');
  select jsonb_build_object(
    'answered', (select count(distinct a.lead_id) from public.qualification_answers a join public.leads l on l.id = a.lead_id
      where os.ctx_in_scope(ctx, l.state, l.site_id) and (f->>'uf' is null or l.state = f->>'uf')),
    'leads', (select count(*) from public.leads l where os.ctx_in_scope(ctx, l.state, l.site_id) and (f->>'uf' is null or l.state = f->>'uf')),
    'questions', (select coalesce(jsonb_object_agg(q.question, q.answers), '{}'::jsonb) from (
      select a.question, jsonb_agg(jsonb_build_object('answer', a.answer, 'n', a.n) order by a.n desc) as answers from (
        select a.question, case when a.question in ('club', 'company') then initcap(lower(trim(a.answer))) else a.answer end as answer, count(*)::int as n
        from public.qualification_answers a join public.leads l on l.id = a.lead_id
        where os.ctx_in_scope(ctx, l.state, l.site_id) and (f->>'uf' is null or l.state = f->>'uf') and length(trim(a.answer)) > 0
        group by 1, 2) a group by a.question) q)) into res;
  return res;
end $$;

create or replace function builder._recent_events(ctx jsonb, f jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare res jsonb;
begin
  perform os.require(ctx, 'builder.analytics.read');
  if ctx->'ufs' is not null and jsonb_typeof(ctx->'ufs') <> 'null' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'at', e.created_at, 'path', e.path, 'props', e.props,
    'source', e.utm_source, 'lead', case when l.id is null then null else jsonb_build_object('id', l.id, 'bora_number', l.bora_number, 'name', l.first_name, 'city', l.city, 'state', l.state) end)
    order by e.created_at desc), '[]'::jsonb) into res
  from (select * from public.events e where (f->>'site_id' is null or e.site_id = f->>'site_id') and (f->>'name' is null or e.name = f->>'name')
        and (f->>'after' is null or e.created_at > (f->>'after')::timestamptz)
        order by e.created_at desc limit least(coalesce((f->>'limit')::int, 100), 300)) e
  left join public.leads l on l.id = e.lead_id;
  return res;
end $$;

-- ── Conteúdo, SEO e configurações ───────────────────────────────────────
create or replace function builder._save_draft(ctx jsonb, p_page uuid, p_seo jsonb, p_content jsonb, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v builder.page_versions; nextv int; base builder.page_versions;
begin
  perform os.require(ctx, 'builder.sites.edit');
  select * into v from builder.page_versions where page_id = p_page and status = 'draft';
  if found then
    update builder.page_versions set seo = coalesce(p_seo, '{}'), content = coalesce(p_content, '{}'), note = p_note,
      created_by = (ctx->>'actor_id')::uuid, created_at = now() where id = v.id returning * into v;
  else
    select coalesce(max(version), 0) + 1 into nextv from builder.page_versions where page_id = p_page;
    insert into builder.page_versions (page_id, version, status, seo, content, note, created_by)
    values (p_page, nextv, 'draft', coalesce(p_seo, '{}'), coalesce(p_content, '{}'), p_note, (ctx->>'actor_id')::uuid) returning * into v;
  end if;
  return to_jsonb(v);
end $$;

create or replace function builder._publish(ctx jsonb, p_version uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v builder.page_versions; nextv int; pg builder.pages;
begin
  perform os.require(ctx, 'builder.sites.publish');
  select * into v from builder.page_versions where id = p_version for update;
  if not found then raise exception 'nao_encontrado'; end if;
  select * into pg from builder.pages where id = v.page_id;
  update builder.page_versions set status = 'archived' where page_id = v.page_id and status = 'published';
  if v.status = 'archived' then
    -- Voltar uma versão antiga: vira uma versão nova, publicada, com o mesmo conteúdo.
    select coalesce(max(version), 0) + 1 into nextv from builder.page_versions where page_id = v.page_id;
    insert into builder.page_versions (page_id, version, status, seo, content, note, created_by, published_by, published_at)
    values (v.page_id, nextv, 'published', v.seo, v.content, 'Volta da versão ' || v.version, (ctx->>'actor_id')::uuid, (ctx->>'actor_id')::uuid, now())
    returning * into v;
  else
    update builder.page_versions set status = 'published', published_by = (ctx->>'actor_id')::uuid, published_at = now() where id = v.id returning * into v;
  end if;
  return to_jsonb(v) || jsonb_build_object('site_id', pg.site_id, 'route', pg.route);
end $$;

create or replace function builder._save_settings(ctx jsonb, p_site text, p_settings jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform os.require(ctx, 'builder.sites.edit');
  insert into builder.site_settings (site_id, settings, updated_at, updated_by) values (p_site, p_settings, now(), (ctx->>'actor_id')::uuid)
  on conflict (site_id) do update set settings = excluded.settings, updated_at = now(), updated_by = excluded.updated_by;
  return jsonb_build_object('ok', true);
end $$;

-- ── Leitura pública para as LPs (chave de serviço) ─────────────────────
create or replace function builder.published_content(p_site text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'settings', coalesce((select settings from builder.site_settings where site_id = p_site), '{}'::jsonb),
    'pages', coalesce((select jsonb_object_agg(pg.route, jsonb_build_object('version', v.version, 'seo', v.seo, 'content', v.content))
      from builder.pages pg join builder.page_versions v on v.page_id = pg.id and v.status = 'published' where pg.site_id = p_site), '{}'::jsonb));
$$;

-- ── Funções públicas do OS: montam o contexto do membro e chamam as internas ──
create or replace function builder.search_leads(f jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._search_leads(os.ctx(), f) $$;
create or replace function builder.get_lead(p_id uuid, p_reveal boolean default false) returns jsonb language sql security definer set search_path = '' as $$ select builder._get_lead(os.ctx(), p_id, p_reveal) $$;
create or replace function builder.create_lead(p jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._create_lead(os.ctx(), p) $$;
create or replace function builder.update_lead(p_id uuid, p jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._update_lead(os.ctx(), p_id, p) $$;
create or replace function builder.anonymize_lead(p_id uuid) returns jsonb language sql security definer set search_path = '' as $$ select builder._anonymize_lead(os.ctx(), p_id) $$;
create or replace function builder.export_leads(f jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._export_leads(os.ctx(), f) $$;
create or replace function builder.add_note(p_lead uuid, p_body text) returns jsonb language sql security definer set search_path = '' as $$ select builder._add_note(os.ctx(), p_lead, p_body) $$;
create or replace function builder.set_tags(p_lead uuid, p_tags text[]) returns jsonb language sql security definer set search_path = '' as $$ select builder._set_tags(os.ctx(), p_lead, p_tags) $$;
create or replace function builder.dashboard(f jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._dashboard(os.ctx(), f) $$;
create or replace function builder.referrers(f jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._referrers(os.ctx(), f) $$;
create or replace function builder.referral_tree(p_code text) returns jsonb language sql security definer set search_path = '' as $$ select builder._referral_tree(os.ctx(), p_code) $$;
create or replace function builder.origins(f jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._origins(os.ctx(), f) $$;
create or replace function builder.cities(f jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._cities(os.ctx(), f) $$;
create or replace function builder.qualification(f jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._qualification(os.ctx(), f) $$;
create or replace function builder.recent_events(f jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._recent_events(os.ctx(), f) $$;
create or replace function builder.save_draft(p_page uuid, p_seo jsonb, p_content jsonb, p_note text) returns jsonb language sql security definer set search_path = '' as $$ select builder._save_draft(os.ctx(), p_page, p_seo, p_content, p_note) $$;
create or replace function builder.publish(p_version uuid) returns jsonb language sql security definer set search_path = '' as $$ select builder._publish(os.ctx(), p_version) $$;
create or replace function builder.save_settings(p_site text, p_settings jsonb) returns jsonb language sql security definer set search_path = '' as $$ select builder._save_settings(os.ctx(), p_site, p_settings) $$;

revoke execute on all functions in schema builder from public, anon, authenticated;
grant execute on function
  builder.search_leads(jsonb), builder.get_lead(uuid, boolean), builder.create_lead(jsonb), builder.update_lead(uuid, jsonb),
  builder.anonymize_lead(uuid), builder.export_leads(jsonb), builder.add_note(uuid, text), builder.set_tags(uuid, text[]),
  builder.dashboard(jsonb), builder.referrers(jsonb), builder.referral_tree(text), builder.origins(jsonb), builder.cities(jsonb),
  builder.qualification(jsonb), builder.recent_events(jsonb), builder.save_draft(uuid, jsonb, jsonb, text), builder.publish(uuid),
  builder.save_settings(text, jsonb)
to authenticated;
grant execute on all functions in schema builder to service_role;
