-- 0014 · Contexto do membro numa chamada só (membro, permissões, papéis, escopo): uma ida ao banco por tela em vez de cinco.
create or replace function os.my_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not os.session_ok() then null else jsonb_build_object(
    'member', (select to_jsonb(m) - 'invited_by' - 'created_at' - 'updated_at' - 'last_seen_at' from os.members m where m.user_id = auth.uid()),
    'perms', to_jsonb(os.my_permissions()),
    'roles', coalesce((select jsonb_agg(r.name order by r.name) from os.member_roles mr join os.roles r on r.id = mr.role_id where mr.user_id = auth.uid()), '[]'::jsonb),
    'ufs', (select to_jsonb(s.ufs) from os.member_scopes s where s.user_id = auth.uid())) end;
$$;
revoke execute on function os.my_context() from public, anon;
grant execute on function os.my_context() to authenticated, service_role;
