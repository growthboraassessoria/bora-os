-- 0009 · referral_network (da LP) com search_path fixo, para rodar dentro das funções do OS;
-- autoria vira null quando o usuário do Auth é apagado (o registro de auditoria guarda quem foi).
alter function public.referral_network(text) set search_path = public;

alter table public.leads drop constraint if exists leads_created_by_fkey, add constraint leads_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.leads drop constraint if exists leads_updated_by_fkey, add constraint leads_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;
alter table os.members drop constraint if exists members_invited_by_fkey, add constraint members_invited_by_fkey foreign key (invited_by) references auth.users(id) on delete set null;
alter table os.roles drop constraint if exists roles_created_by_fkey, add constraint roles_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table builder.page_versions drop constraint if exists page_versions_created_by_fkey, add constraint page_versions_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table builder.page_versions drop constraint if exists page_versions_published_by_fkey, add constraint page_versions_published_by_fkey foreign key (published_by) references auth.users(id) on delete set null;
alter table builder.site_settings drop constraint if exists site_settings_updated_by_fkey, add constraint site_settings_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;
alter table builder.lead_notes drop constraint if exists lead_notes_created_by_fkey, add constraint lead_notes_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
