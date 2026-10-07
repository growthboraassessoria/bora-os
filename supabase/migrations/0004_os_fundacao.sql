-- 0004 · BORA OS: membros, papéis, permissões, escopo e auditoria.
-- Toda permissão exige: membro ativo, sessão com segundo fator (aal2) e sessão ainda existente.

create schema if not exists os;
revoke all on schema os from public, anon;
grant usage on schema os to authenticated, service_role;
alter default privileges in schema os revoke execute on functions from public;

-- ── Tabelas ─────────────────────────────────────────────────────────────
create table os.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  must_change_password boolean not null default true,
  invited_by uuid references auth.users(id),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table os.permissions (
  key text primary key,
  module text not null,
  label text not null,
  description text not null,
  sensitive boolean not null default false,
  sort int not null default 0
);

create table os.roles (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null unique,
  description text not null default '',
  is_system boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table os.role_permissions (
  role_id uuid not null references os.roles(id) on delete cascade,
  permission_key text not null references os.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table os.member_roles (
  user_id uuid not null references os.members(user_id) on delete cascade,
  role_id uuid not null references os.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

-- Escopo opcional. Sem linha (ou com null), vale tudo o que o papel permite.
create table os.member_scopes (
  user_id uuid primary key references os.members(user_id) on delete cascade,
  ufs text[],
  site_ids text[]
);

create table os.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('member', 'mcp', 'lp', 'system')),
  actor_id text,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  meta jsonb not null default '{}'::jsonb
);
create index audit_log_at_idx on os.audit_log (at desc);
create index audit_log_entity_idx on os.audit_log (entity, entity_id, at desc);
create index audit_log_actor_idx on os.audit_log (actor_type, actor_id, at desc);

-- ── Catálogo de permissões ──────────────────────────────────────────────
insert into os.permissions (key, module, label, description, sensitive, sort) values
  ('builder.dashboard.read',  'builder', 'Ver painel',              'Painel e números agregados das LPs.', false, 10),
  ('builder.leads.read',      'builder', 'Ver cadastros',           'Lista e ficha, com contato mascarado.', false, 20),
  ('builder.leads.pii',       'builder', 'Ver dados pessoais',      'Revelar e-mail, telefone, CPF e nascimento; buscar por eles.', true, 30),
  ('builder.leads.create',    'builder', 'Criar cadastros',         'Cadastrar pessoas pelo OS.', false, 40),
  ('builder.leads.edit',      'builder', 'Editar cadastros',        'Editar dados, notas e etiquetas.', false, 50),
  ('builder.leads.anonymize', 'builder', 'Anonimizar cadastros',    'Atender pedido de exclusão (LGPD).', true, 60),
  ('builder.leads.export',    'builder', 'Exportar cadastros',      'Baixar CSV.', true, 70),
  ('builder.referrals.read',  'builder', 'Ver indicações',          'Ranking de indicadores e rede.', false, 80),
  ('builder.analytics.read',  'builder', 'Ver analytics',           'Funil, origem, eventos e teste A/B.', false, 90),
  ('builder.sites.read',      'builder', 'Ver sites',               'Conteúdo, SEO e configurações das LPs.', false, 100),
  ('builder.sites.edit',      'builder', 'Editar sites',            'Rascunhos de SEO, textos e configurações.', false, 110),
  ('builder.sites.publish',   'builder', 'Publicar sites',          'Publicar e voltar versões na LP.', false, 120),
  ('admin.members.manage',    'admin',   'Gerenciar membros',       'Criar, suspender, papéis e escopo.', true, 200),
  ('admin.roles.manage',      'admin',   'Gerenciar papéis',        'Criar papéis e marcar permissões.', true, 210),
  ('admin.audit.read',        'admin',   'Ver auditoria',           'Registro de tudo o que mudou.', false, 220),
  ('admin.security.manage',   'admin',   'Segurança da conta',      'Zerar segundo fator e encerrar sessões de outros. Só proprietário.', true, 230),
  ('mcp.connections.manage',  'mcp',     'Gerenciar conexões MCP',  'Criar e revogar chaves.', true, 300),
  ('mcp.calls.read',          'mcp',     'Ver chamadas MCP',        'Registro de chamadas.', false, 310);

insert into os.roles (slug, name, description, is_system) values
  ('owner',     'Proprietário', 'Tudo, inclusive segurança de outros membros.', true),
  ('admin',     'Admin',        'Tudo, menos zerar segundo fator de outros.', true),
  ('growth',    'Growth',       'Painel, cadastros com contato, edição, exportação, analytics e sites.', true),
  ('comercial', 'Comercial',    'Cadastros com contato e edição. Normalmente com escopo de UF.', true),
  ('leitura',   'Leitura',      'Painel e analytics; cadastros mascarados.', true);

insert into os.role_permissions (role_id, permission_key)
select r.id, p.key from os.roles r cross join os.permissions p
where r.slug = 'owner'
   or (r.slug = 'admin' and p.key <> 'admin.security.manage')
   or (r.slug = 'growth' and p.key in ('builder.dashboard.read','builder.leads.read','builder.leads.pii','builder.leads.create','builder.leads.edit','builder.leads.export','builder.referrals.read','builder.analytics.read','builder.sites.read','builder.sites.edit','builder.sites.publish'))
   or (r.slug = 'comercial' and p.key in ('builder.dashboard.read','builder.leads.read','builder.leads.pii','builder.leads.create','builder.leads.edit','builder.referrals.read'))
   or (r.slug = 'leitura' and p.key in ('builder.dashboard.read','builder.leads.read','builder.referrals.read','builder.analytics.read','builder.sites.read'));

-- ── Contexto e permissões ───────────────────────────────────────────────
create or replace function os.session_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
     and exists (select 1 from auth.sessions s where s.id = nullif(auth.jwt()->>'session_id', '')::uuid and s.user_id = auth.uid())
     and exists (select 1 from os.members m where m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function os.has_perm(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select os.session_ok() and exists (
    select 1 from os.member_roles mr join os.role_permissions rp on rp.role_id = mr.role_id
    where mr.user_id = auth.uid() and rp.permission_key = p);
$$;

create or replace function os.my_permissions() returns text[]
language sql stable security definer set search_path = '' as $$
  select case when os.session_ok() then coalesce(array(
    select distinct rp.permission_key from os.member_roles mr join os.role_permissions rp on rp.role_id = mr.role_id
    where mr.user_id = auth.uid() order by 1), '{}') else '{}'::text[] end;
$$;

-- Contexto de execução usado pelas funções internas: quem age, com quais permissões e escopo.
create or replace function os.ctx() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'actor_type', 'member',
    'actor_id', auth.uid()::text,
    'perms', to_jsonb(os.my_permissions()),
    'ufs', (select to_jsonb(s.ufs) from os.member_scopes s where s.user_id = auth.uid()),
    'sites', (select to_jsonb(s.site_ids) from os.member_scopes s where s.user_id = auth.uid()));
$$;

create or replace function os.ctx_has(ctx jsonb, p text) returns boolean
language sql immutable set search_path = '' as $$ select coalesce(ctx->'perms' ? p, false) $$;

create or replace function os.ctx_in_scope(ctx jsonb, uf text, site text) returns boolean
language sql immutable set search_path = '' as $$
  select (ctx->'ufs' is null or jsonb_typeof(ctx->'ufs') = 'null' or ctx->'ufs' ? uf)
     and (ctx->'sites' is null or jsonb_typeof(ctx->'sites') = 'null' or ctx->'sites' ? site);
$$;

create or replace function os.require(ctx jsonb, p text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if not os.ctx_has(ctx, p) then raise exception 'sem_permissao: %', p using errcode = '42501'; end if;
end $$;

-- Escopo do membro atual, para políticas RLS (avaliado uma vez por consulta).
create or replace function os.scope_ufs() returns text[]
language sql stable security definer set search_path = '' as $$ select s.ufs from os.member_scopes s where s.user_id = auth.uid() $$;
create or replace function os.scope_sites() returns text[]
language sql stable security definer set search_path = '' as $$ select s.site_ids from os.member_scopes s where s.user_id = auth.uid() $$;

-- ── Auditoria ───────────────────────────────────────────────────────────
-- Quem age: membro logado; senão o ator definido na transação (mcp, system); senão a LP (chave de serviço).
create or replace function os.actor() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is not null then jsonb_build_object('type', 'member', 'id', auth.uid()::text)
    when nullif(current_setting('bora.actor_type', true), '') is not null
      then jsonb_build_object('type', current_setting('bora.actor_type', true), 'id', nullif(current_setting('bora.actor_id', true), ''))
    when coalesce(auth.role(), '') = 'service_role' then jsonb_build_object('type', 'lp', 'id', null)
    else jsonb_build_object('type', 'system', 'id', null) end;
$$;

create or replace function os.mask_pii(j jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when j is null then null else
    (select coalesce(jsonb_object_agg(k, case
       when k in ('email','phone','cpf','birth_date','ip_hash','user_agent','token_hash') and v <> 'null'::jsonb then to_jsonb('•••'::text)
       else v end), '{}'::jsonb)
     from jsonb_each(j) as e(k, v)) end;
$$;

create or replace function os.write_audit(p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb, p_meta jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare a jsonb := os.actor();
begin
  insert into os.audit_log (actor_type, actor_id, action, entity, entity_id, before, after, meta)
  values (a->>'type', a->>'id', p_action, p_entity, p_entity_id, os.mask_pii(p_before), os.mask_pii(p_after), coalesce(p_meta, '{}'));
end $$;

create or replace function os.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  b jsonb; n jsonb; k text; id text; diff_b jsonb := '{}'; diff_n jsonb := '{}';
begin
  if tg_op = 'INSERT' then n := to_jsonb(new); b := null;
  elsif tg_op = 'DELETE' then b := to_jsonb(old); n := null;
  else
    b := to_jsonb(old); n := to_jsonb(new);
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at', 'last_seen_at', 'last_used_at') and (b->k) is distinct from (n->k) then
        diff_b := diff_b || jsonb_build_object(k, b->k);
        diff_n := diff_n || jsonb_build_object(k, n->k);
      end if;
    end loop;
    if diff_n = '{}'::jsonb then return new; end if;
    b := diff_b; n := diff_n;
  end if;
  id := coalesce(to_jsonb(coalesce(new, old))->>'id', to_jsonb(coalesce(new, old))->>'user_id', to_jsonb(coalesce(new, old))->>'lead_id',
                 to_jsonb(coalesce(new, old))->>'key', to_jsonb(coalesce(new, old))->>'uf', to_jsonb(coalesce(new, old))->>'site_id');
  perform os.write_audit(lower(tg_op), tg_table_schema || '.' || tg_table_name, id, b, n);
  return coalesce(new, old);
end $$;

create or replace function os.audit_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'auditoria_imutavel' using errcode = '42501'; end $$;
create trigger audit_log_immutable before update or delete on os.audit_log for each row execute function os.audit_immutable();
create trigger audit_log_no_truncate before truncate on os.audit_log execute function os.audit_immutable();

-- Eventos de aplicação (login, revelação de dado pessoal, exportação). Membro ativo; ações de login aceitas antes do aal2.
create or replace function os.log_event(p_action text, p_entity text default 'os.session', p_entity_id text default null, p_meta jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from os.members m where m.user_id = auth.uid() and m.status = 'active') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if not os.session_ok() and p_action not like 'auth.%' then
    raise exception 'segundo_fator_obrigatorio' using errcode = '42501';
  end if;
  perform os.write_audit(p_action, p_entity, p_entity_id, null, null, p_meta);
  update os.members set last_seen_at = now() where user_id = auth.uid();
end $$;

-- ── Regras de papéis ────────────────────────────────────────────────────
create or replace function os.guard_roles() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := (select id from os.roles where slug = 'owner');
begin
  if tg_table_name = 'roles' then
    if tg_op = 'DELETE' and old.is_system then raise exception 'papel_do_sistema' using errcode = '42501'; end if;
    if tg_op = 'UPDATE' and old.is_system and (new.slug is distinct from old.slug or new.is_system <> old.is_system) then
      raise exception 'papel_do_sistema' using errcode = '42501';
    end if;
    return coalesce(new, old);
  end if;
  if tg_table_name = 'role_permissions' then
    if coalesce(new.role_id, old.role_id) = owner_id and auth.uid() is not null then
      raise exception 'proprietario_tem_todas' using errcode = '42501';
    end if;
    return coalesce(new, old);
  end if;
  -- member_roles: só quem tem segurança concede ou retira o papel de proprietário
  if coalesce(new.role_id, old.role_id) = owner_id and auth.uid() is not null and not os.has_perm('admin.security.manage') then
    raise exception 'so_proprietario' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create or replace function os.guard_last_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from os.member_roles mr join os.roles r on r.id = mr.role_id join os.members m on m.user_id = mr.user_id
    where r.slug = 'owner' and m.status = 'active')
  and exists (select 1 from os.members) then
    raise exception 'precisa_de_um_proprietario' using errcode = '42501';
  end if;
  return null;
end $$;

create trigger roles_guard before update or delete on os.roles for each row execute function os.guard_roles();
create trigger role_permissions_guard before insert or delete on os.role_permissions for each row execute function os.guard_roles();
create trigger member_roles_guard before insert or delete on os.member_roles for each row execute function os.guard_roles();
create constraint trigger member_roles_last_owner after delete on os.member_roles deferrable initially deferred for each row execute function os.guard_last_owner();
create constraint trigger members_last_owner after update of status on os.members deferrable initially deferred for each row execute function os.guard_last_owner();

create or replace function os.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger members_touch before update on os.members for each row execute function os.touch_updated_at();

create trigger members_audit after insert or update or delete on os.members for each row execute function os.audit_trigger();
create trigger roles_audit after insert or update or delete on os.roles for each row execute function os.audit_trigger();
create trigger role_permissions_audit after insert or delete on os.role_permissions for each row execute function os.audit_trigger();
create trigger member_roles_audit after insert or delete on os.member_roles for each row execute function os.audit_trigger();
create trigger member_scopes_audit after insert or update or delete on os.member_scopes for each row execute function os.audit_trigger();

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table os.members enable row level security;
alter table os.permissions enable row level security;
alter table os.roles enable row level security;
alter table os.role_permissions enable row level security;
alter table os.member_roles enable row level security;
alter table os.member_scopes enable row level security;
alter table os.audit_log enable row level security;

create policy members_read on os.members for select to authenticated
  using ((select os.has_perm('admin.members.manage')) or (user_id = auth.uid() and (select os.session_ok())));
create policy members_update on os.members for update to authenticated
  using ((select os.has_perm('admin.members.manage')) and user_id <> auth.uid())
  with check ((select os.has_perm('admin.members.manage')));

create policy permissions_read on os.permissions for select to authenticated using ((select os.session_ok()));
create policy roles_read on os.roles for select to authenticated using ((select os.session_ok()));
create policy roles_write on os.roles for all to authenticated
  using ((select os.has_perm('admin.roles.manage'))) with check ((select os.has_perm('admin.roles.manage')));
create policy role_permissions_read on os.role_permissions for select to authenticated using ((select os.session_ok()));
create policy role_permissions_write on os.role_permissions for all to authenticated
  using ((select os.has_perm('admin.roles.manage'))) with check ((select os.has_perm('admin.roles.manage')));
create policy member_roles_read on os.member_roles for select to authenticated
  using ((select os.has_perm('admin.members.manage')) or (user_id = auth.uid() and (select os.session_ok())));
create policy member_roles_write on os.member_roles for all to authenticated
  using ((select os.has_perm('admin.members.manage')) and user_id <> auth.uid())
  with check ((select os.has_perm('admin.members.manage')) and user_id <> auth.uid());
create policy member_scopes_read on os.member_scopes for select to authenticated
  using ((select os.has_perm('admin.members.manage')) or (user_id = auth.uid() and (select os.session_ok())));
create policy member_scopes_write on os.member_scopes for all to authenticated
  using ((select os.has_perm('admin.members.manage')) and user_id <> auth.uid())
  with check ((select os.has_perm('admin.members.manage')) and user_id <> auth.uid());
create policy audit_read on os.audit_log for select to authenticated using ((select os.has_perm('admin.audit.read')));

grant select on os.members, os.permissions, os.roles, os.role_permissions, os.member_roles, os.member_scopes, os.audit_log to authenticated;
grant update (full_name, status) on os.members to authenticated;
grant insert, update, delete on os.roles, os.role_permissions, os.member_roles, os.member_scopes to authenticated;
grant all on all tables in schema os to service_role;
grant usage on all sequences in schema os to service_role;

revoke execute on all functions in schema os from public, anon;
grant execute on function os.session_ok(), os.has_perm(text), os.my_permissions(), os.ctx(), os.scope_ufs(), os.scope_sites(), os.log_event(text, text, text, jsonb) to authenticated;
grant execute on all functions in schema os to service_role;

-- ── Funções de administração (chamadas pelo servidor com a chave de serviço, depois de conferir a permissão do membro) ──
create or replace function os.admin_upsert_member(p_actor uuid, p_user_id uuid, p_email text, p_full_name text, p_role_slugs text[], p_ufs text[], p_must_change boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('bora.actor_type', 'member', true);
  perform set_config('bora.actor_id', coalesce(p_actor::text, ''), true);
  insert into os.members (user_id, email, full_name, invited_by, must_change_password)
  values (p_user_id, lower(p_email), p_full_name, p_actor, p_must_change)
  on conflict (user_id) do update set full_name = excluded.full_name, must_change_password = excluded.must_change_password;
  if p_role_slugs is not null then
    delete from os.member_roles where user_id = p_user_id and role_id not in (select id from os.roles where slug = any(p_role_slugs));
    insert into os.member_roles (user_id, role_id) select p_user_id, id from os.roles where slug = any(p_role_slugs) on conflict do nothing;
  end if;
  insert into os.member_scopes (user_id, ufs) values (p_user_id, p_ufs)
  on conflict (user_id) do update set ufs = excluded.ufs;
end $$;

create or replace function os.admin_password_changed(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('bora.actor_type', 'member', true);
  perform set_config('bora.actor_id', p_user_id::text, true);
  update os.members set must_change_password = false where user_id = p_user_id;
end $$;

-- Sessões de um membro (para a tela de segurança) e encerramento.
create or replace function os.member_sessions(p_user_id uuid)
returns table (id uuid, created_at timestamptz, refreshed_at timestamptz, user_agent text, ip text, aal text, current boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user_id <> auth.uid() and not os.has_perm('admin.members.manage') then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if not os.session_ok() then raise exception 'segundo_fator_obrigatorio' using errcode = '42501'; end if;
  return query select s.id, s.created_at, coalesce(s.refreshed_at::timestamptz, s.updated_at), s.user_agent, host(s.ip), s.aal::text,
    s.id = nullif(auth.jwt()->>'session_id', '')::uuid
    from auth.sessions s where s.user_id = p_user_id order by coalesce(s.refreshed_at::timestamptz, s.updated_at) desc nulls last;
end $$;

create or replace function os.end_sessions(p_user_id uuid, p_session_id uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not os.session_ok() then raise exception 'segundo_fator_obrigatorio' using errcode = '42501'; end if;
  if p_user_id <> auth.uid() and not os.has_perm('admin.security.manage') then raise exception 'sem_permissao' using errcode = '42501'; end if;
  delete from auth.sessions s where s.user_id = p_user_id and (p_session_id is null or s.id = p_session_id)
    and s.id <> nullif(auth.jwt()->>'session_id', '')::uuid;
  get diagnostics n = row_count;
  perform os.write_audit('sessions.ended', 'os.members', p_user_id::text, null, null, jsonb_build_object('count', n, 'session', p_session_id));
  return n;
end $$;
revoke execute on function os.member_sessions(uuid), os.end_sessions(uuid, uuid) from public, anon;
grant execute on function os.member_sessions(uuid), os.end_sessions(uuid, uuid) to authenticated;
revoke execute on function os.admin_upsert_member(uuid, uuid, text, text, text[], text[], boolean), os.admin_password_changed(uuid) from public, anon, authenticated;
