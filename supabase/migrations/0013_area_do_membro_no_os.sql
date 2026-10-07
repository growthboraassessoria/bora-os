-- 0013 · Área do membro da LP (0003) dentro do OS: segundo telefone tratado como dado pessoal (mascarado,
-- revelado só com permissão, apagado na anonimização), perfil público e Instagram na ficha e editáveis,
-- e o login do membro (last_login_at) fora do registro de alterações.

create or replace function os.mask_pii(j jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when j is null then null else
    (select coalesce(jsonb_object_agg(k, case
       when k in ('email','phone','phone2','cpf','birth_date','ip_hash','user_agent','token_hash') and v <> 'null'::jsonb then to_jsonb('•••'::text)
       else v end), '{}'::jsonb)
     from jsonb_each(j) as e(k, v)) end;
$$;

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
      if k not in ('updated_at', 'last_seen_at', 'last_used_at', 'last_login_at') and (b->k) is distinct from (n->k) then
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

create or replace function builder._lead_json(l public.leads, show_pii boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id, 'bora_number', l.bora_number, 'first_name', l.first_name, 'last_name', l.last_name,
    'email', case when show_pii then l.email else builder.mask_email(l.email) end,
    'phone', case when show_pii then l.phone else builder.mask_phone(l.phone) end,
    'phone2', case when show_pii then l.phone2 else builder.mask_phone(l.phone2) end,
    'cpf', case when show_pii then l.cpf else builder.mask_cpf(l.cpf) end,
    'birth_date', case when show_pii then l.birth_date::text when l.birth_date is null then null else '••/••/••••' end,
    'pii_masked', not show_pii,
    'sex', l.sex, 'cep', l.cep, 'city_slug', l.city_slug, 'city', l.city, 'state', l.state,
    'referral_code', l.referral_code, 'referred_by', l.referred_by,
    'privacy_consent', l.privacy_consent, 'marketing_consent', l.marketing_consent,
    'utm', jsonb_build_object('source', l.utm_source, 'medium', l.utm_medium, 'campaign', l.utm_campaign, 'content', l.utm_content, 'term', l.utm_term),
    'first_touch', l.first_touch, 'last_touch', l.last_touch, 'experiment', l.experiment, 'external_ids', l.external_ids,
    'instagram', l.instagram, 'bio', l.bio, 'photo_url', l.photo_url, 'public_profile', l.public_profile, 'public_whatsapp', l.public_whatsapp, 'last_login_at', l.last_login_at,
    'site_id', l.site_id, 'source', l.source, 'created_at', l.created_at, 'updated_at', l.updated_at, 'anonymized_at', l.anonymized_at);
$$;

create or replace function builder._update_lead(ctx jsonb, p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.leads; k text; pii_keys text[] := array['email', 'phone', 'phone2', 'cpf', 'birth_date'];
  allowed text[] := array['first_name', 'last_name', 'email', 'phone', 'phone2', 'cpf', 'birth_date', 'sex', 'cep', 'marketing_consent', 'instagram', 'bio', 'public_profile', 'public_whatsapp'];
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
  if p ? 'phone2' and nullif(p->>'phone2', '') is not null and length(builder.clean_phone(p->>'phone2')) not between 10 and 11 then raise exception 'invalido: telefone'; end if;
  if p ? 'instagram' and nullif(p->>'instagram', '') is not null and p->>'instagram' !~ '^@?[A-Za-z0-9._]{1,30}$' then raise exception 'invalido: instagram'; end if;
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
    phone2 = case when p ? 'phone2' then nullif(builder.clean_phone(p->>'phone2'), '') else phone2 end,
    instagram = case when p ? 'instagram' then nullif(ltrim(trim(p->>'instagram'), '@'), '') else instagram end,
    bio = case when p ? 'bio' then nullif(left(trim(p->>'bio'), 140), '') else bio end,
    public_profile = case when p ? 'public_profile' then (p->>'public_profile')::boolean else public_profile end,
    public_whatsapp = case when p ? 'public_whatsapp' then (p->>'public_whatsapp')::boolean else public_whatsapp end,
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

create or replace function builder._anonymize_lead(ctx jsonb, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.leads;
begin
  perform os.require(ctx, 'builder.leads.anonymize');
  select * into l from public.leads where id = p_id for update;
  if not found or not os.ctx_in_scope(ctx, l.state, l.site_id) then raise exception 'nao_encontrado'; end if;
  update public.leads set first_name = 'Anonimizado', last_name = '#' || bora_number, email = 'anonimizado+' || id || '@bora.invalid',
    phone = '00' || lpad(bora_number::text, 9, '0'), phone2 = null, instagram = null, bio = null, photo_url = null, public_profile = false, public_whatsapp = false, cpf = null, birth_date = null, sex = null, ip_hash = null, user_agent = null,
    first_touch = null, last_touch = null, marketing_consent = false, anonymized_at = now(), updated_at = now(),
    updated_by = case when ctx->>'actor_type' = 'member' then (ctx->>'actor_id')::uuid end
  where id = p_id;
  update public.events set ip_hash = null, user_agent = null where lead_id = p_id;
  delete from public.qualification_answers where lead_id = p_id and question in ('company', 'club');
  delete from builder.lead_notes where lead_id = p_id;
  return jsonb_build_object('ok', true);
end $$;

