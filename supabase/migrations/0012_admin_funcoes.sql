-- 0012 · Funções de admin chamadas pelo servidor (chave de serviço) com o autor certo na auditoria.
create or replace function os.admin_log(p_actor uuid, p_action text, p_entity_id text, p_meta jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('bora.actor_type', 'member', true);
  perform set_config('bora.actor_id', coalesce(p_actor::text, ''), true);
  perform os.write_audit(p_action, 'os.members', p_entity_id, null, null, coalesce(p_meta, '{}'));
end $$;

create or replace function os.admin_flag_password(p_actor uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('bora.actor_type', 'member', true);
  perform set_config('bora.actor_id', coalesce(p_actor::text, ''), true);
  update os.members set must_change_password = true where user_id = p_user_id;
end $$;

revoke execute on function os.admin_log(uuid, text, text, jsonb), os.admin_flag_password(uuid, uuid) from public, anon, authenticated;
grant execute on function os.admin_log(uuid, text, text, jsonb), os.admin_flag_password(uuid, uuid) to service_role;
