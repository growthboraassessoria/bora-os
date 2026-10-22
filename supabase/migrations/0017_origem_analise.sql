-- Origem: a função passa a devolver canais, série, jornada primeiro→último,
-- qualidade por fonte e comparação com o período anterior. A tela e o MCP
-- continuam lendo `rows`, `touch` e `events_visible`.
-- Visitantes usam o UTM do page_view (toque da visita). Cadastros seguem
-- o toque pedido (primeiro ou último). Idempotente: create or replace.

create or replace function builder._origins(ctx jsonb, f jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t0 timestamptz := coalesce((f->>'from')::timestamptz, now() - interval '30 days');
  t1 timestamptz := coalesce((f->>'to')::timestamptz, now());
  span interval := t1 - t0;
  touch text := case when f->>'touch' = 'first' then 'first' else 'last' end;
  site text := f->>'site_id';
  uf text := nullif(f->>'uf', '');
  src_filter text := nullif(f->>'source', '');
  scoped boolean := ctx->'ufs' is not null and jsonb_typeof(ctx->'ufs') <> 'null';
  can_events boolean := os.ctx_has(ctx, 'builder.analytics.read') and not scoped and uf is null;
  grain text := case when (t1 - t0) <= interval '36 hours' then 'hour' else 'day' end;
  res jsonb;
begin
  perform os.require(ctx, 'builder.analytics.read');
  with
  tagged as (
    select x.*,
      coalesce(case when touch = 'first' then x.first_touch->>'utm_source' else x.utm_source end, '(direto)') as src,
      coalesce(case when touch = 'first' then x.first_touch->>'utm_medium' else x.utm_medium end, '—') as med,
      coalesce(case when touch = 'first' then x.first_touch->>'utm_campaign' else x.utm_campaign end, '—') as camp,
      coalesce(case when touch = 'first' then x.first_touch->>'utm_content' else x.utm_content end, '—') as cont,
      coalesce(case when touch = 'first' then x.first_touch->>'utm_term' else x.utm_term end, '—') as term,
      exists (select 1 from public.qualification_answers a where a.lead_id = x.id) as answered,
      exists (select 1 from public.founder_status fs where fs.lead_id = x.id and fs.status = 'active') as founder
    from public.leads x
    where os.ctx_in_scope(ctx, x.state, x.site_id)
      and (site is null or x.site_id = site)
      and (uf is null or x.state = uf)
  ),
  dim as (
    select t.*,
      case
        when lower(t.med) in ('cpc', 'ppc', 'paid', 'cpm', 'cpa', 'ads', 'paid_social', 'paid-social', 'display') then 'pago'
        when lower(t.med) in ('referral', 'indicacao', 'indicação') then 'indicacao'
        when lower(t.med) in ('social', 'organic_social', 'social_organic', 'social-organic')
          or lower(t.src) in ('instagram', 'facebook', 'meta', 'tiktok', 'twitter', 'x', 'linkedin', 'youtube', 'whatsapp', 'threads') then 'social'
        when lower(t.med) in ('organic', 'seo', 'email', 'newsletter')
          or lower(t.src) in ('google', 'bing', 'yahoo', 'duckduckgo') then 'organico'
        when t.src = '(direto)' then 'direto'
        else 'outro'
      end as channel
    from tagged t
    where src_filter is null or t.src = src_filter
  ),
  cur as (select * from dim where created_at >= t0 and created_at < t1),
  prev as (select * from dim where created_at >= t0 - span and created_at < t0),
  ev as (
    select e.session_id, e.path, e.created_at, e.name,
      coalesce(e.utm_source, '(direto)') as src,
      coalesce(e.utm_medium, '—') as med,
      coalesce(e.utm_campaign, '—') as camp,
      case
        when lower(coalesce(e.utm_medium, '')) in ('cpc', 'ppc', 'paid', 'cpm', 'cpa', 'ads', 'paid_social', 'paid-social', 'display') then 'pago'
        when lower(coalesce(e.utm_medium, '')) in ('referral', 'indicacao', 'indicação') then 'indicacao'
        when lower(coalesce(e.utm_medium, '')) in ('social', 'organic_social', 'social_organic', 'social-organic')
          or lower(coalesce(e.utm_source, '')) in ('instagram', 'facebook', 'meta', 'tiktok', 'twitter', 'x', 'linkedin', 'youtube', 'whatsapp', 'threads') then 'social'
        when lower(coalesce(e.utm_medium, '')) in ('organic', 'seo', 'email', 'newsletter')
          or lower(coalesce(e.utm_source, '')) in ('google', 'bing', 'yahoo', 'duckduckgo') then 'organico'
        when e.utm_source is null then 'direto'
        else 'outro'
      end as channel
    from public.events e
    where can_events
      and (site is null or e.site_id = site)
      and e.created_at >= t0 - span and e.created_at < t1
      and e.name = 'page_view'
      and (src_filter is null or coalesce(e.utm_source, '(direto)') = src_filter)
  ),
  buckets as (
    select generate_series(
      date_trunc(grain, t0 at time zone 'America/Sao_Paulo'),
      date_trunc(grain, (t1 - interval '1 second') at time zone 'America/Sao_Paulo'),
      case when grain = 'hour' then interval '1 hour' else interval '1 day' end
    ) as b
  )
  select jsonb_build_object(
    'touch', touch,
    'events_visible', can_events,
    'grain', grain,
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'source', s.src, 'medium', s.med, 'campaign', s.camp, 'content', s.cont, 'term', s.term,
        'leads', s.leads, 'referred', s.referred, 'answered', s.answered, 'founders', s.founders,
        'leads_prev', coalesce(p.leads, 0),
        'visitors', case when can_events then coalesce(v.visitors, 0) end
      ) order by s.leads desc, s.src, s.med, s.camp), '[]'::jsonb)
      from (
        select src, med, camp, cont, term, count(*)::int as leads,
          count(*) filter (where referred_by is not null)::int as referred,
          count(*) filter (where answered)::int as answered,
          count(*) filter (where founder)::int as founders
        from cur group by 1, 2, 3, 4, 5
      ) s
      left join (
        select src, med, camp, cont, term, count(*)::int as leads from prev group by 1, 2, 3, 4, 5
      ) p on p.src = s.src and p.med = s.med and p.camp = s.camp and p.cont = s.cont and p.term = s.term
      left join (
        select src, med, camp, count(distinct session_id)::int as visitors
        from ev where created_at >= t0 group by 1, 2, 3
      ) v on v.src = s.src and v.med = s.med and v.camp = s.camp
    ),
    'kpis', jsonb_build_object(
      'leads', (select count(*) from cur),
      'leads_prev', (select count(*) from prev),
      'referred', (select count(*) from cur where referred_by is not null),
      'referred_prev', (select count(*) from prev where referred_by is not null),
      'identified', (select count(*) from cur where src <> '(direto)'),
      'identified_prev', (select count(*) from prev where src <> '(direto)'),
      'direct', (select count(*) from cur where src = '(direto)'),
      'answered', (select count(*) from cur where answered),
      'founders', (select count(*) from cur where founder),
      'sources', (select count(distinct src) from cur),
      'campaigns', (select count(distinct camp) from cur where camp <> '—'),
      'media', (select count(distinct med) from cur where med <> '—'),
      'visitors', case when can_events then (select count(distinct session_id) from ev where created_at >= t0) end,
      'visitors_prev', case when can_events then (select count(distinct session_id) from ev where created_at < t0) end
    ),
    'channels', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'channel', c.channel, 'leads', c.leads, 'referred', c.referred, 'answered', c.answered,
        'visitors', case when can_events then coalesce(v.visitors, 0) end
      ) order by c.leads desc), '[]'::jsonb)
      from (
        select channel, count(*)::int as leads,
          count(*) filter (where referred_by is not null)::int as referred,
          count(*) filter (where answered)::int as answered
        from cur group by 1
      ) c
      left join (
        select channel, count(distinct session_id)::int as visitors
        from ev where created_at >= t0 group by 1
      ) v on v.channel = c.channel
    ),
    'by_source', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'source', s.src, 'leads', s.leads, 'referred', s.referred, 'answered', s.answered, 'founders', s.founders,
        'leads_prev', coalesce(p.leads, 0),
        'visitors', case when can_events then coalesce(v.visitors, 0) end
      ) order by s.leads desc), '[]'::jsonb)
      from (
        select src, count(*)::int as leads,
          count(*) filter (where referred_by is not null)::int as referred,
          count(*) filter (where answered)::int as answered,
          count(*) filter (where founder)::int as founders
        from cur group by 1
      ) s
      left join (select src, count(*)::int as leads from prev group by 1) p on p.src = s.src
      left join (
        select src, count(distinct session_id)::int as visitors from ev where created_at >= t0 group by 1
      ) v on v.src = s.src
    ),
    'by_medium', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'medium', s.med, 'leads', s.leads, 'referred', s.referred,
        'visitors', case when can_events then coalesce(v.visitors, 0) end
      ) order by s.leads desc), '[]'::jsonb)
      from (
        select med, count(*)::int as leads, count(*) filter (where referred_by is not null)::int as referred
        from cur group by 1
      ) s
      left join (
        select med, count(distinct session_id)::int as visitors from ev where created_at >= t0 group by 1
      ) v on v.med = s.med
    ),
    'by_campaign', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'campaign', s.camp, 'source', s.src, 'medium', s.med, 'leads', s.leads, 'referred', s.referred, 'answered', s.answered,
        'visitors', case when can_events then coalesce(v.visitors, 0) end
      ) order by s.leads desc), '[]'::jsonb)
      from (
        select camp, src, med, count(*)::int as leads,
          count(*) filter (where referred_by is not null)::int as referred,
          count(*) filter (where answered)::int as answered
        from cur where camp <> '—' group by 1, 2, 3
      ) s
      left join (
        select camp, src, med, count(distinct session_id)::int as visitors
        from ev where created_at >= t0 group by 1, 2, 3
      ) v on v.camp = s.camp and v.src = s.src and v.med = s.med
    ),
    'by_content', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'content', s.cont, 'campaign', s.camp, 'source', s.src, 'leads', s.leads,
        'visitors', case when can_events then coalesce(v.visitors, 0) end
      ) order by s.leads desc), '[]'::jsonb)
      from (
        select cont, camp, src, count(*)::int as leads from cur where cont <> '—' group by 1, 2, 3
      ) s
      left join (
        select camp, src, count(distinct session_id)::int as visitors
        from ev where created_at >= t0 group by 1, 2
      ) v on v.camp = s.camp and v.src = s.src
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'at', to_char(b.b, case when grain = 'hour' then 'YYYY-MM-DD HH24:00' else 'YYYY-MM-DD' end),
        'leads', (select count(*) from cur where date_trunc(grain, created_at at time zone 'America/Sao_Paulo') = b.b),
        'referred', (select count(*) from cur where referred_by is not null and date_trunc(grain, created_at at time zone 'America/Sao_Paulo') = b.b),
        'identified', (select count(*) from cur where src <> '(direto)' and date_trunc(grain, created_at at time zone 'America/Sao_Paulo') = b.b),
        'visitors', case when can_events then (
          select count(distinct session_id) from ev
          where created_at >= t0 and date_trunc(grain, created_at at time zone 'America/Sao_Paulo') = b.b
        ) end
      ) order by b.b), '[]'::jsonb)
      from buckets b
    ),
    'journeys', (
      select coalesce(jsonb_agg(jsonb_build_object('first', j.first, 'last', j.last, 'n', j.n, 'assisted', j.assisted) order by j.n desc), '[]'::jsonb)
      from (
        select
          coalesce(first_touch->>'utm_source', '(direto)') as first,
          coalesce(utm_source, '(direto)') as last,
          count(*)::int as n,
          (coalesce(first_touch->>'utm_source', '(direto)') is distinct from coalesce(utm_source, '(direto)')) as assisted
        from cur
        group by 1, 2
        order by 3 desc
        limit 16
      ) j
    ),
    'attribution', jsonb_build_object(
      'same', (select count(*) from cur where coalesce(first_touch->>'utm_source', '(direto)') = coalesce(utm_source, '(direto)')),
      'changed', (select count(*) from cur where coalesce(first_touch->>'utm_source', '(direto)') is distinct from coalesce(utm_source, '(direto)')),
      'first_then_direct', (select count(*) from cur where coalesce(first_touch->>'utm_source', '(direto)') <> '(direto)' and utm_source is null),
      'direct_then_tagged', (select count(*) from cur where first_touch->>'utm_source' is null and utm_source is not null)
    ),
    'by_uf', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'uf', u.uf, 'leads', u.leads, 'top_source', u.top_source, 'top_leads', u.top_leads
      ) order by u.leads desc), '[]'::jsonb)
      from (
        select state as uf, sum(n)::int as leads,
          (array_agg(src order by n desc, src))[1] as top_source,
          (array_agg(n order by n desc, src))[1] as top_leads
        from (select state, src, count(*)::int as n from cur group by 1, 2) s
        group by state
      ) u
    ),
    'paths', case when can_events then (
      select coalesce(jsonb_agg(jsonb_build_object('path', p.path, 'visitors', p.visitors) order by p.visitors desc), '[]'::jsonb)
      from (
        select coalesce(nullif(path, ''), '/') as path, count(distinct session_id)::int as visitors
        from ev where created_at >= t0
        group by 1
        order by 2 desc
        limit 8
      ) p
    ) end
  ) into res;
  return res;
end $$;

update mcp.tools
set description = 'Cadastros por origem: canais, fontes, campanhas, jornada primeiro→último toque e qualidade.'
where name = 'origem_cadastros';
