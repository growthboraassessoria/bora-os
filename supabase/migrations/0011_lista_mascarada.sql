-- 0011 · Lista sempre com contato mascarado; o dado completo sai só na revelação (ficha) e na exportação, ambas auditadas.
create or replace function builder._search_leads(ctx jsonb, f jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  q text := nullif(trim(coalesce(f->>'q', '')), '');
  qd text := regexp_replace(coalesce(f->>'q', ''), '\D', '', 'g');
  pii boolean := os.ctx_has(ctx, 'builder.leads.pii');
  show boolean := pii and coalesce((f->>'reveal')::boolean, false);
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
  into rows using show, lim, off;

  return jsonb_build_object('total', total, 'rows', rows, 'pii', show, 'can_reveal', pii);
end $$;

create or replace function builder._export_leads(ctx jsonb, f jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare res jsonb;
begin
  perform os.require(ctx, 'builder.leads.export');
  res := builder._search_leads(ctx, coalesce(f, '{}'::jsonb) || jsonb_build_object('limit', 500, 'offset', coalesce((f->>'offset')::int, 0), 'reveal', true));
  perform os.write_audit('leads.exported', 'public.leads', null, null, null,
    jsonb_build_object('rows', jsonb_array_length(res->'rows'), 'pii', res->'pii', 'filters', coalesce(f, '{}'::jsonb) - 'q'));
  return res;
end $$;

