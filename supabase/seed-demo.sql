-- Dados FICTÍCIOS para a homologação. Nunca rodar em produção.
-- Uso: supabase db query --linked -f supabase/seed-demo.sql (projeto bora-os-staging)
do $$ begin
  if current_database() <> 'postgres' or exists (select 1 from public.leads where source = 'lp' and email not like '%@exemplo.com.br') then
    raise exception 'seed recusado: a base parece ter dados reais';
  end if;
end $$;

select set_config('bora.actor_type', 'system', false);
truncate public.events, public.referral_clicks, public.qualification_answers, public.founder_status, builder.lead_notes, builder.lead_tags cascade;
delete from public.leads;
delete from public.cities;
alter sequence bora_number_seq restart with 1;

insert into public.cities (slug, name, uf, lat, lng) values
  ('go-goiania','Goiânia','GO',-16.6869,-49.2648), ('pe-recife','Recife','PE',-8.0476,-34.8770), ('es-vitoria','Vitória','ES',-20.3155,-40.3128),
  ('ce-fortaleza','Fortaleza','CE',-3.7319,-38.5267), ('ba-salvador','Salvador','BA',-12.9777,-38.5016), ('pr-curitiba','Curitiba','PR',-25.4284,-49.2733),
  ('sc-florianopolis','Florianópolis','SC',-27.5954,-48.5480), ('mg-belo-horizonte','Belo Horizonte','MG',-19.9167,-43.9345), ('sp-campinas','Campinas','SP',-22.9099,-47.0626),
  ('rn-natal','Natal','RN',-5.7945,-35.2110), ('pb-joao-pessoa','João Pessoa','PB',-7.1195,-34.8450), ('mg-uberlandia','Uberlândia','MG',-18.9186,-48.2772),
  ('go-anapolis','Anápolis','GO',-16.3281,-48.9530), ('mt-cuiaba','Cuiabá','MT',-15.6014,-56.0979), ('rs-porto-alegre','Porto Alegre','RS',-30.0346,-51.2177),
  ('ma-sao-luis','São Luís','MA',-2.5307,-44.3068)
on conflict (slug) do nothing;

update public.states set whatsapp_url = 'https://chat.whatsapp.com/exemplo-' || lower(uf) where uf in ('GO','PE','ES');

-- Cadastros: pesos por cidade, 45 dias, ~25% vindos de indicação.
with w(slug, weight) as (values ('go-goiania',22),('pe-recife',16),('es-vitoria',13),('ce-fortaleza',11),('ba-salvador',9),('pr-curitiba',7),('sc-florianopolis',6),
  ('mg-belo-horizonte',5),('sp-campinas',4),('rn-natal',3),('pb-joao-pessoa',3),('mg-uberlandia',2),('go-anapolis',2),('mt-cuiaba',1),('rs-porto-alegre',1),('ma-sao-luis',1)),
pool as (select c.slug, c.name, c.uf from w join public.cities c using (slug), generate_series(1, w.weight)),
fn(n, i) as (select n, row_number() over () from unnest(array['Ana','Bruno','Carla','Diego','Eduarda','Felipe','Gabriela','Henrique','Isabela','João','Karina','Lucas','Mariana','Nicolas','Olívia','Pedro','Rafaela','Samuel','Tatiane','Vinícius','Júlia','Marcos','Letícia','Thiago','Camila','Rodrigo','Beatriz','André','Larissa','Gustavo']) n),
ln(n, i) as (select n, row_number() over () from unnest(array['Silva','Souza','Oliveira','Santos','Lima','Pereira','Costa','Almeida','Ferreira','Rodrigues','Gomes','Martins','Araújo','Barbosa','Ribeiro','Carvalho','Rocha','Dias','Moreira','Nunes']) n),
gen as (
  select g, p.slug, p.name, p.uf, now() - (power(random(), 1.6) * interval '45 days') as at
  from generate_series(1, 1400) g cross join lateral (select * from pool order by random() + g * 0 limit 1) p)
insert into public.leads (first_name, last_name, email, phone, cep, sex, birth_date, city_slug, city, state, referral_code, privacy_consent, marketing_consent,
  utm_source, utm_medium, utm_campaign, first_touch, last_touch, experiment, created_at)
select f.n, l.n, lower(translate(f.n, 'áéíóúâêôãõç', 'aeiouaeoaoc')) || '.' || lower(translate(l.n, 'áéíóúâêôãõç', 'aeiouaeoaoc')) || g || '@exemplo.com.br',
  (array['62','81','27','85','71','41','48','31','19','84','83','34','62','65','51','98'])[1 + (g % 16)] || '9' || lpad((10000000 + g * 7919 % 89999999)::text, 8, '0'),
  lpad((g * 104729 % 99999999)::text, 8, '0'), (array['F','M','F','M','N'])[1 + g % 5], (date '1975-01-01' + (g * 37 % 12000)),
  gen.slug, gen.name, gen.uf,
  upper(left(translate(f.n, 'áéíóúâêôãõç', 'aeiouaeoaoc'), 8)) || (100 + g % 900)::text || chr(65 + g % 26), true, random() < 0.7,
  s.src, s.med, s.camp, jsonb_strip_nulls(jsonb_build_object('utm_source', s.src, 'utm_medium', s.med, 'utm_campaign', s.camp)),
  jsonb_strip_nulls(jsonb_build_object('utm_source', s.src, 'utm_medium', s.med, 'utm_campaign', s.camp)),
  jsonb_build_object('hero', case when g % 2 = 0 then 'A' else 'B' end), gen.at
from gen
join fn f on f.i = 1 + (g * 7 % 30)
join ln l on l.i = 1 + (g * 11 % 20)
cross join lateral (select * from (values
   ('instagram','social','bora_vamos_em_frente'), ('instagram','social','bora_vamos_em_frente'), ('instagram','paid','bora_vamos_em_frente_ads'),
   ('meta','paid','bora_vamos_em_frente_ads'), ('whatsapp','referral','bora_vamos_em_frente'), ('google','cpc','bora_cidades'),
   (null,null,null), (null,null,null), ('tiktok','social','bora_vamos_em_frente')) v(src, med, camp) offset (g * 13 % 9) limit 1) s;

-- Códigos únicos no formato da LP (letras + 3 dígitos), pela mesma regra do OS.
do $$ declare r record; begin
  for r in select id, first_name from public.leads order by bora_number loop
    update public.leads set referral_code = builder.make_code(r.first_name) where id = r.id;
  end loop;
end $$;

-- Indicações: ~28% dos cadastros vêm de alguém da mesma cidade que entrou antes.
update public.leads l set referred_by = (select x.referral_code from public.leads x where x.city_slug = l.city_slug and x.created_at < l.created_at
  order by (x.bora_number % 7 = 0) desc, random() limit 1)
where random() < 0.28;
update public.leads set utm_source = 'whatsapp', utm_medium = 'referral' where referred_by is not null;

-- Fundadores, respostas, notas.
insert into public.founder_status (lead_id, city_slug, founder_number, status, provider, amount, purchased_at)
select id, city_slug, row_number() over (partition by city_slug order by created_at), 'active', 'demo', 49, created_at + interval '2 days'
from public.leads where random() < 0.06;

insert into public.qualification_answers (lead_id, question, answer)
select l.id, q.question, q.answers[1 + floor(random() * array_length(q.answers, 1))::int]
from public.leads l cross join (values
  ('runs', array['Sim, corro com frequência','Sim, de vez em quando','Estou começando','Ainda não']),
  ('with', array['Sozinho','Com amigos','Com um running club','Com outra assessoria']),
  ('distance', array['Até 5 km','Até 10 km','Até 21 km','Maratona ou mais']),
  ('goal', array['Começar a correr','Primeira prova','Melhorar o tempo','Saúde e rotina','Meia ou maratona']),
  ('open', array['Sim, com certeza','Talvez','Não']),
  ('intent', array['Sim','Provavelmente','Depende do preço','Não']),
  ('price', array['Até R$ 99','R$ 100 a R$ 149','R$ 150 a R$ 199','Acima de R$ 200']),
  ('club', array['Pace Norte','Sunset Run Club','Clube Aurora','Trilha Leste','','']),
  ('company', array['Banco do Brasil','Unimed','Natura','','','Prefeitura'])) q(question, answers)
where (hashtext(l.id::text) % 100) < 42;
delete from public.qualification_answers where answer = '';

-- Eventos: visitantes, funil e compartilhamentos.
insert into public.events (name, session_id, path, props, utm_source, utm_medium, utm_campaign, created_at)
select 'page_view', 's' || g, '/', jsonb_build_object('variant', case when g % 2 = 0 then 'A' else 'B' end),
  (array['instagram','instagram','meta','google',null,null,'whatsapp','tiktok'])[1 + g % 8], null, 'bora_vamos_em_frente',
  now() - (power(random(), 1.6) * interval '45 days')
from generate_series(1, 9800) g;
insert into public.events (name, session_id, path, created_at)
select 'form_started', session_id, '/', created_at + interval '40 seconds' from public.events where name = 'page_view' and random() < 0.31;
insert into public.events (name, session_id, path, created_at)
select 'cep_resolved', session_id, '/', created_at + interval '70 seconds' from public.events where name = 'form_started' and random() < 0.62;
insert into public.events (name, lead_id, session_id, path, props, created_at)
select 'form_completed', id, 'l' || bora_number, '/', jsonb_build_object('city', city, 'uf', state, 'variant', experiment->>'hero', 'referred', referred_by is not null), created_at from public.leads;
insert into public.events (name, lead_id, session_id, path, created_at)
select (array['share_whatsapp','share_copy','share_instagram'])[1 + bora_number % 3], id, 'l' || bora_number, '/obrigado', created_at + interval '3 minutes'
from public.leads where random() < 0.38;
insert into public.referral_clicks (referral_code, owner_lead_id, utm_source, utm_medium, created_at)
select l.referral_code, l.id, 'whatsapp', 'referral', l.created_at + (random() * interval '5 days')
from public.leads l, generate_series(1, 3) where random() < 0.3;

select count(*) as leads, count(*) filter (where referred_by is not null) as referred from public.leads;
