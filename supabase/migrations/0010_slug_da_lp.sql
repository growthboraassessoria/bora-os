-- 0010 · Slug de cidade no formato da LP: uf-cidade (ex.: go-goiania).
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
    v_slug := coalesce(v_slug, lower(v_uf) || '-' || trim(both '-' from lower(regexp_replace(translate(p->>'city', 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^A-Za-z0-9]+', '-', 'g'))));
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

