import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { ago, dateTime } from "@/lib/format";
import { PageHead, Panel, Chip, th, td, cx } from "@/components/ui";
import { NewMember, MemberPanel, type MemberView } from "./forms";

export const metadata = { title: "Membros" };

export default async function Membros({ searchParams }: { searchParams: Promise<{ id?: string; novo?: string }> }) {
  const a = await requirePerm("admin.members.manage");
  const sp = await searchParams;
  const os = a.db.schema("os");
  const [{ data: members }, { data: roles }, { data: links }, { data: scopes }, users] = await Promise.all([
    os.from("members").select("user_id,email,full_name,status,must_change_password,last_seen_at,created_at").order("full_name"),
    os.from("roles").select("id,slug,name").order("name"),
    os.from("member_roles").select("user_id,role_id"),
    os.from("member_scopes").select("user_id,ufs"),
    adminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const totp = new Map((users.data?.users ?? []).map((u) => [u.id, (u.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified")]));
  const roleName = new Map((roles ?? []).map((r) => [r.id, r.name]));
  const view: MemberView[] = (members ?? []).map((m) => ({
    ...m,
    role_ids: (links ?? []).filter((l) => l.user_id === m.user_id).map((l) => l.role_id),
    ufs: (scopes ?? []).find((s) => s.user_id === m.user_id)?.ufs ?? null,
    totp: totp.get(m.user_id) ?? false,
  }));
  const sel = view.find((m) => m.user_id === sp.id);
  const sessions = sel ? (await os.rpc("member_sessions", { p_user_id: sel.user_id })).data ?? [] : [];

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        <PageHead eyebrow="Admin · Membros" title="Quem acessa o BORA OS" desc="Todo membro entra com senha e Google Authenticator. Quem é criado aqui recebe uma senha provisória e troca no primeiro acesso." />
        <div className="grid gap-4 xl:grid-cols-3">
          <Panel eyebrow={`${view.length} membros`} title="Membros" pad={false} className="xl:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead><tr><th className={th}>Nome</th><th className={th}>Papéis</th><th className={th}>Escopo</th><th className={th}>2FA</th><th className={th}>Status</th><th className={th}>Último acesso</th></tr></thead>
                <tbody>
                  {view.map((m) => (
                    <tr key={m.user_id} className={cx("relative hover:bg-surface-2", sp.id === m.user_id && "bg-surface-2")}>
                      <td className={td}><Link href={`?id=${m.user_id}`} scroll={false} className="after:absolute after:inset-0">{m.full_name}</Link> <span className="text-fg-3">{m.email}</span>{m.user_id === a.member.user_id && <Chip tone="outline" className="ml-1.5">você</Chip>}</td>
                      <td className={td}>{m.role_ids.map((r) => roleName.get(r)).join(" · ") || <span className="text-fg-3">nenhum</span>}</td>
                      <td className={`${td} mono text-[12px]`}>{m.ufs?.join(" ") ?? <span className="text-fg-3">tudo</span>}</td>
                      <td className={td}>{m.totp ? <Chip>ativo</Chip> : <Chip tone="warning">pendente</Chip>}</td>
                      <td className={td}>{m.status === "active" ? (m.must_change_password ? <Chip tone="outline">1º acesso</Chip> : <Chip tone="signal">ativo</Chip>) : <Chip tone="danger">suspenso</Chip>}</td>
                      <td className={`${td} text-fg-2`} title={dateTime(m.last_seen_at)}>{m.last_seen_at ? ago(m.last_seen_at) : "nunca"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <NewMember roles={(roles ?? []).filter((r) => r.slug !== "owner" || a.perms.has("admin.security.manage"))} />
        </div>
      </div>
      {sel && (
        <div className="fixed inset-0 z-30 xl:static xl:z-auto">
          <MemberPanel key={sel.user_id} m={sel} roles={roles ?? []} sessions={sessions} me={a.member.user_id} canSecurity={a.perms.has("admin.security.manage")} />
        </div>
      )}
    </div>
  );
}
