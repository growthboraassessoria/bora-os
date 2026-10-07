import { requireSession } from "@/lib/auth";
import { ago, dateTime } from "@/lib/format";
import { PageHead, Panel, KV, Chip } from "@/components/ui";
import { ChangePassword, EndOtherSessions } from "./forms";

export const metadata = { title: "Minha conta" };

export default async function Conta() {
  const a = await requireSession();
  const [{ data: sessions }, { data: factors }] = await Promise.all([
    a.db.schema("os").rpc("member_sessions", { p_user_id: a.member.user_id }),
    a.db.auth.mfa.listFactors(),
  ]);
  const list = (sessions ?? []) as { id: string; created_at: string; refreshed_at: string | null; user_agent: string | null; ip: string | null; current: boolean }[];
  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="Minha conta" title={a.member.full_name} desc={a.member.email} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Acesso" title="Papéis e escopo">
          <KV k="Papéis" v={a.roles.join(" · ") || "—"} />
          <KV k="Escopo" v={a.ufs?.join(", ") ?? "todo o Brasil"} />
          <KV k="Permissões" v={a.perms.size} mono />
          <KV k="Última confirmação do autenticador" v={a.totpAt ? ago(new Date(a.totpAt * 1000).toISOString()) : "—"} />
        </Panel>
        <Panel eyebrow="Segundo fator" title="Google Authenticator">
          {(factors?.totp ?? []).map((f) => <KV key={f.id} k={f.friendly_name ?? "Autenticador"} v={<Chip tone="signal">ativo · {dateTime(f.created_at)}</Chip>} />)}
          <p className="mt-3 text-fg-3">Perdeu o celular? Peça a um proprietário para zerar o autenticador; você configura de novo no próximo login.</p>
        </Panel>
        <ChangePassword />
        <Panel eyebrow={`${list.length} sessões`} title="Onde você está conectado" className="xl:col-span-3" right={list.length > 1 ? <EndOtherSessions userId={a.member.user_id} /> : null}>
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => (
              <li key={s.id} className="rounded-sm border border-line px-3 py-2">
                <p className="truncate">{s.user_agent?.replace(/\(.*?\)/g, "").slice(0, 70) ?? "—"}</p>
                <p className="mono text-[11px] text-fg-3">{s.ip ?? "—"} · {s.refreshed_at ? ago(s.refreshed_at) : dateTime(s.created_at)} {s.current && "· esta sessão"}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
