-- 0003 · Área do membro (07/10/2026): perfil editável, foto, Instagram, segundo telefone e perfil público por cidade.
alter table leads add column if not exists phone2 text;
alter table leads add column if not exists instagram text;
alter table leads add column if not exists bio text;
alter table leads add column if not exists photo_url text;
alter table leads add column if not exists public_profile boolean not null default false;
alter table leads add column if not exists public_whatsapp boolean not null default false;
alter table leads add column if not exists updated_at timestamptz not null default now();
alter table leads add column if not exists last_login_at timestamptz;
create index if not exists leads_public_profile_idx on leads (city_slug) where public_profile;

-- Fotos de perfil: leitura pública, escrita só pelo servidor (chave de serviço).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'avatars leitura publica') then
    create policy "avatars leitura publica" on storage.objects for select using (bucket_id = 'avatars');
  end if;
end $$;
