-- 0002 · BORA ID, dados pessoais e leitura das respostas (07/10/2026)
-- Decisões do Alex: criar o BORA ID já na LP, numeração nacional a partir de #0001,
-- mostrar número e QR na carteirinha digital; captar sexo, data de nascimento e CPF.

-- BORA ID: número sequencial nacional, estável e legível. Quem já estava na base recebe pela ordem de chegada.
create sequence if not exists bora_number_seq start 1;
alter table leads add column if not exists bora_number integer;
with ordered as (
  select id, row_number() over (order by created_at, id) as n from leads where bora_number is null
)
update leads l set bora_number = o.n from ordered o where o.id = l.id;
select setval('bora_number_seq', coalesce((select max(bora_number) from leads), 0) + 1, false);
alter table leads alter column bora_number set default nextval('bora_number_seq');
alter table leads alter column bora_number set not null;
create unique index if not exists leads_bora_number_key on leads (bora_number);

-- Ligações com outros sistemas (CRM, Runy, checkout), quando existirem.
alter table leads add column if not exists external_ids jsonb not null default '{}'::jsonb;

-- Dados pessoais novos. O aviso de privacidade da LP descreve o uso.
alter table leads add column if not exists sex text;
alter table leads add column if not exists birth_date date;
alter table leads add column if not exists cpf text;
alter table leads drop constraint if exists leads_sex_check;
alter table leads add constraint leads_sex_check check (sex is null or sex in ('F', 'M', 'N'));
alter table leads drop constraint if exists leads_cpf_check;
alter table leads add constraint leads_cpf_check check (cpf is null or cpf ~ '^[0-9]{11}$');
create unique index if not exists leads_cpf_key on leads (cpf) where cpf is not null;

-- Respostas: uma linha por lead e pergunta; a última resposta vale.
delete from qualification_answers a using qualification_answers b
  where a.lead_id = b.lead_id and a.question = b.question
    and (a.created_at < b.created_at or (a.created_at = b.created_at and a.ctid < b.ctid));
create unique index if not exists qualification_lead_question_key on qualification_answers (lead_id, question);

-- Leitura agregada das respostas (sem dados de contato) e BORA IDs ativos nos últimos 30 dias.
-- As views rodam com os direitos de quem consulta, então o RLS das tabelas continua valendo.
create or replace view qualification_summary with (security_invoker = true) as
select l.state, l.city, q.question, q.answer, count(*)::int as n
from qualification_answers q join leads l on l.id = q.lead_id
group by 1, 2, 3, 4;

create or replace view bora_ids_ativos with (security_invoker = true) as
select count(distinct l.id)::int as ativos
from leads l
where exists (select 1 from events e where e.lead_id = l.id and e.created_at > now() - interval '30 days')
   or exists (select 1 from founder_status f where f.lead_id = l.id and f.status = 'active');

revoke all on qualification_summary, bora_ids_ativos from anon, authenticated;
