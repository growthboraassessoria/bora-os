-- 0006 · MCP: conexões externas com chave própria, catálogo de ferramentas, registro de chamadas e gateway.
-- O gateway entra no Postgres com o papel mcp_gateway, que só executa mcp.describe e mcp.call.
-- A senha do papel é definida fora do git: alter role mcp_gateway with login password '...';

create schema if not exists mcp;
revoke all on schema mcp from public, anon;
grant usage on schema mcp to authenticated, service_role;
alter default privileges in schema mcp revoke execute on functions from public;

create table mcp.tools (
  name text primary key,
  description text not null,
  required_perm text not null references os.permissions(key),
  write boolean not null default false,
  enabled boolean not null default true,
  sort int not null default 0
);

insert into mcp.tools (name, description, required_perm, write, enabled, sort) values
  ('resumo_campanha',        'Indicadores do painel da LP num período.', 'builder.dashboard.read', false, true, 10),
  ('buscar_cadastros',       'Lista de cadastros com filtros. Contato mascarado sem a permissão de dados pessoais.', 'builder.leads.read', false, true, 20),
  ('ver_cadastro',           'Ficha de um cadastro por BORA ID ou código de indicação.', 'builder.leads.read', false, true, 30),
  ('ranking_cidades',        'Ranking de cidades com meta e vagas de Fundador.', 'builder.dashboard.read', false, true, 40),
  ('rede_indicacao',         'Rede de indicação de um código.', 'builder.referrals.read', false, true, 50),
  ('origem_cadastros',       'Cadastros por UTM (fonte, meio, campanha).', 'builder.analytics.read', false, true, 60),
  ('respostas_qualificacao', 'Distribuição das respostas da qualificação.', 'builder.analytics.read', false, true, 70),
  ('eventos_recentes',       'Últimos eventos da LP, sem dado pessoal.', 'builder.analytics.read', false, true, 80),
  ('criar_cadastro',         'Cria um cadastro (deduplica por telefone, e-mail e CPF).', 'builder.leads.create', true, false, 90),
  ('atualizar_cadastro',     'Atualiza campos de um cadastro.', 'builder.leads.edit', true, false, 100);

create table mcp.connections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 60),
  token_prefix text not null,
  token_hash text not null unique,
  created_by uuid not null references os.members(user_id) on delete cascade,
  permissions text[] not null default '{}',
  tools text[],
  ip_allowlist cidr[],
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '90 days 1 minute')
);

create table mcp.calls (
  id bigint generated always as identity primary key,
  connection_id uuid references mcp.connections(id) on delete set null,
  tool text,
  args jsonb not null default '{}'::jsonb,
  status text not null check (status in ('ok', 'error', 'denied')),
  error text,
  rows int,
  duration_ms int,
  ip text,
  at timestamptz not null default now()
);
create index calls_conn_at_idx on mcp.calls (connection_id, at desc);
create index calls_at_idx on mcp.calls (at desc);

create trigger connections_audit after insert or update or delete on mcp.connections for each row execute function os.audit_trigger();
create trigger tools_audit after update on mcp.tools for each row execute function os.audit_trigger();

alter table mcp.tools enable row level security;
alter table mcp.connections enable row level security;
alter table mcp.calls enable row level security;

create policy tools_read on mcp.tools for select to authenticated using ((select os.session_ok()));
create policy tools_edit on mcp.tools for update to authenticated using ((select os.has_perm('mcp.connections.manage'))) with check ((select os.has_perm('mcp.connections.manage')));
create policy connections_read on mcp.connections for select to authenticated
  using ((select os.has_perm('mcp.connections.manage')) or (created_by = auth.uid() and (select os.session_ok())));
create policy calls_read on mcp.calls for select to authenticated using ((select os.has_perm('mcp.calls.read')));

grant select on mcp.tools, mcp.calls to authenticated;
grant update (enabled) on mcp.tools to authenticated;
grant select (id, name, token_prefix, created_by, permissions, tools, ip_allowlist, expires_at, last_used_at, revoked_at, created_at) on mcp.connections to authenticated;
grant all on all tables in schema mcp to service_role;

-- ── Criar e revogar (membro logado) ─────────────────────────────────────
-- A chave é gerada no servidor do OS; aqui chega só o hash. Permissões nunca passam as do criador.
create or replace function mcp.create_connection(p_name text, p_prefix text, p_hash text, p_permissions text[], p_tools text[], p_days int, p_ips cidr[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare mine text[] := os.my_permissions(); cid uuid;
begin
  if not os.has_perm('mcp.connections.manage') then raise exception 'sem_permissao: mcp.connections.manage' using errcode = '42501'; end if;
  if exists (select 1 from unnest(p_permissions) p where not p = any(mine)) then raise exception 'sem_permissao: acima_do_criador' using errcode = '42501'; end if;
  if exists (select 1 from unnest(p_permissions) p where p like 'admin.%' or p like 'mcp.%') then raise exception 'invalido: permissao_administrativa'; end if;
  if p_days not between 1 and 90 then raise exception 'invalido: validade'; end if;
  insert into mcp.connections (name, token_prefix, token_hash, created_by, permissions, tools, ip_allowlist, expires_at)
  values (trim(p_name), p_prefix, p_hash, auth.uid(), p_permissions, p_tools, p_ips, now() + make_interval(days => p_days))
  returning id into cid;
  return cid;
end $$;

create or replace function mcp.revoke_connection(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (os.has_perm('mcp.connections.manage') or exists (select 1 from mcp.connections c where c.id = p_id and c.created_by = auth.uid() and os.session_ok())) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  update mcp.connections set revoked_at = now() where id = p_id and revoked_at is null;
end $$;

-- ── Gateway ─────────────────────────────────────────────────────────────
-- Autentica a chave e monta o contexto: permissões = as da conexão ∩ as do criador hoje; escopo = o do criador.
create or replace function mcp._auth(p_hash text, p_ip text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c mcp.connections; creator_perms text[]; eff text[];
begin
  select * into c from mcp.connections where token_hash = p_hash;
  if not found or c.revoked_at is not null or c.expires_at < now() then return null; end if;
  if not exists (select 1 from os.members m where m.user_id = c.created_by and m.status = 'active') then return null; end if;
  if c.ip_allowlist is not null and cardinality(c.ip_allowlist) > 0
     and not exists (select 1 from unnest(c.ip_allowlist) n where p_ip is not null and p_ip::inet <<= n) then return null; end if;
  select coalesce(array_agg(distinct rp.permission_key), '{}') into creator_perms
    from os.member_roles mr join os.role_permissions rp on rp.role_id = mr.role_id where mr.user_id = c.created_by;
  select coalesce(array_agg(p), '{}') into eff from unnest(c.permissions) p where p = any(creator_perms);
  update mcp.connections set last_used_at = now() where id = c.id;
  return jsonb_build_object('actor_type', 'mcp', 'actor_id', c.id::text, 'connection', c.id, 'name', c.name, 'tools', to_jsonb(c.tools),
    'perms', to_jsonb(eff),
    'ufs', (select to_jsonb(s.ufs) from os.member_scopes s where s.user_id = c.created_by),
    'sites', (select to_jsonb(s.site_ids) from os.member_scopes s where s.user_id = c.created_by));
end $$;

-- Ferramentas que a conexão pode usar.
create or replace function mcp.describe(p_hash text, p_ip text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ctx jsonb := mcp._auth(p_hash, p_ip);
begin
  if ctx is null then return null; end if;
  return jsonb_build_object('name', ctx->>'name', 'connection', ctx->>'connection',
    'tools', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'description', t.description, 'write', t.write) order by t.sort)
      from mcp.tools t where t.enabled and os.ctx_has(ctx, t.required_perm)
        and (ctx->'tools' is null or jsonb_typeof(ctx->'tools') = 'null' or ctx->'tools' ? t.name)), '[]'::jsonb));
end $$;

create or replace function mcp.call(p_hash text, p_tool text, p_args jsonb, p_ip text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ctx jsonb := mcp._auth(p_hash, p_ip);
  t mcp.tools; started timestamptz := clock_timestamp(); res jsonb; cid uuid; n int; lead_id uuid; a jsonb := coalesce(p_args, '{}'::jsonb);
  safe_args jsonb;
begin
  safe_args := os.mask_pii(a);
  if ctx is null then
    insert into mcp.calls (connection_id, tool, args, status, error, ip) values (null, p_tool, safe_args, 'denied', 'chave_invalida', p_ip);
    return jsonb_build_object('error', 'chave_invalida');
  end if;
  cid := (ctx->>'connection')::uuid;
  select count(*) into n from mcp.calls where connection_id = cid and at > now() - interval '1 minute';
  if n >= 60 then
    insert into mcp.calls (connection_id, tool, args, status, error, ip) values (cid, p_tool, safe_args, 'denied', 'limite_por_minuto', p_ip);
    return jsonb_build_object('error', 'limite_por_minuto');
  end if;
  select * into t from mcp.tools where name = p_tool;
  if not found or not t.enabled or not os.ctx_has(ctx, t.required_perm)
     or not (ctx->'tools' is null or jsonb_typeof(ctx->'tools') = 'null' or ctx->'tools' ? p_tool) then
    insert into mcp.calls (connection_id, tool, args, status, error, ip) values (cid, p_tool, safe_args, 'denied', 'ferramenta_nao_liberada', p_ip);
    return jsonb_build_object('error', 'ferramenta_nao_liberada');
  end if;

  perform set_config('bora.actor_type', 'mcp', true);
  perform set_config('bora.actor_id', cid::text, true);
  begin
    if p_tool in ('ver_cadastro', 'atualizar_cadastro') then
      select l.id into lead_id from public.leads l
      where (a->>'bora_id' is not null and l.bora_number = ltrim(a->>'bora_id', '#')::int) or (a->>'codigo' is not null and l.referral_code = upper(a->>'codigo'))
         or (a->>'id' is not null and l.id::text = a->>'id') limit 1;
      if lead_id is null then raise exception 'nao_encontrado'; end if;
    end if;
    res := case p_tool
      when 'resumo_campanha' then builder._dashboard(ctx, jsonb_build_object('from', a->>'de', 'to', a->>'ate', 'uf', a->>'uf', 'site_id', a->>'site'))
      when 'buscar_cadastros' then builder._search_leads(ctx, jsonb_strip_nulls(jsonb_build_object('q', a->>'busca', 'uf', a->>'uf', 'city_slug', a->>'cidade',
          'source', a->>'origem', 'referred', a->'indicado', 'from', a->>'de', 'to', a->>'ate', 'limit', coalesce((a->>'limite')::int, 25), 'offset', a->>'pular')))
      when 'ver_cadastro' then builder._get_lead(ctx, lead_id, coalesce((a->>'revelar')::boolean, false)) - 'history' - 'events'
      when 'ranking_cidades' then builder._cities(ctx, jsonb_strip_nulls(jsonb_build_object('uf', a->>'uf', 'site_id', a->>'site')))
      when 'rede_indicacao' then jsonb_build_object('rede', builder._referral_tree(ctx, a->>'codigo'))
      when 'origem_cadastros' then builder._origins(ctx, jsonb_strip_nulls(jsonb_build_object('from', a->>'de', 'to', a->>'ate', 'touch', a->>'toque')))
      when 'respostas_qualificacao' then builder._qualification(ctx, jsonb_strip_nulls(jsonb_build_object('uf', a->>'uf')))
      when 'eventos_recentes' then jsonb_build_object('eventos', builder._recent_events(ctx, jsonb_strip_nulls(jsonb_build_object('name', a->>'evento', 'limit', coalesce((a->>'limite')::int, 50)))))
      when 'criar_cadastro' then builder._create_lead(ctx, a)
      when 'atualizar_cadastro' then builder._update_lead(ctx, lead_id, coalesce(a->'campos', '{}'::jsonb))
    end;
    insert into mcp.calls (connection_id, tool, args, status, rows, duration_ms, ip)
    values (cid, p_tool, safe_args, 'ok', coalesce(jsonb_array_length(case when jsonb_typeof(res->'rows') = 'array' then res->'rows' end), 1),
      extract(milliseconds from clock_timestamp() - started)::int, p_ip);
    return res;
  exception when others then
    insert into mcp.calls (connection_id, tool, args, status, error, duration_ms, ip)
    values (cid, p_tool, safe_args, case when sqlstate = '42501' then 'denied' else 'error' end, left(sqlerrm, 200), extract(milliseconds from clock_timestamp() - started)::int, p_ip);
    return jsonb_build_object('error', left(sqlerrm, 200));
  end;
end $$;

-- Papel do gateway: entra, executa duas funções e mais nada.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'mcp_gateway') then create role mcp_gateway nologin noinherit; end if;
end $$;
revoke all on schema public, os, builder from mcp_gateway;
grant usage on schema mcp to mcp_gateway;

revoke execute on all functions in schema mcp from public, anon, authenticated;
grant execute on function mcp.create_connection(text, text, text, text[], text[], int, cidr[]), mcp.revoke_connection(uuid) to authenticated;
grant execute on function mcp.describe(text, text), mcp.call(text, text, jsonb, text) to mcp_gateway;
grant execute on all functions in schema mcp to service_role;
