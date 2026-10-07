"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, X } from "lucide-react";
import { Button, Chip, Field, Panel, KV, inputCls, cx } from "@/components/ui";
import { UFS } from "@/components/builder/Filters";
import { useStepUp } from "@/components/useStepUp";
import { dateTime, ago } from "@/lib/format";
import { createMember, updateMemberAccess, setMemberStatus, resetPassword, resetMfa, endSessions } from "../actions";

type Role = { id: string; slug: string | null; name: string };
export type MemberView = { user_id: string; email: string; full_name: string; status: string; must_change_password: boolean; last_seen_at: string | null; created_at: string; role_ids: string[]; ufs: string[] | null; totp: boolean };
type Session = { id: string; created_at: string; refreshed_at: string | null; user_agent: string | null; ip: string | null; aal: string | null; current: boolean };

function Secret({ label, value, onDone }: { label: string; value: string; onDone: () => void }) {
  return (
    <div className="rounded-sm border border-line-strong p-3">
      <p className="eyebrow mb-1">{label}</p>
      <code className="mono block break-all text-[13px] text-fg">{value}</code>
      <p className="mt-1 text-[11.5px] text-fg-3">Aparece só agora. Passe por um canal seguro; a pessoa troca no primeiro acesso.</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={() => navigator.clipboard.writeText(value)}><Copy size={13} />Copiar</Button>
        <Button variant="ghost" onClick={onDone}>Concluir</Button>
      </div>
    </div>
  );
}

function UfChooser({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {UFS.map((u) => {
        const on = value.includes(u);
        return <button type="button" key={u} onClick={() => onChange(on ? value.filter((x) => x !== u) : [...value, u])}
          className={cx("mono h-6 w-9 rounded-xs border text-[11px]", on ? "border-active bg-surface-3 text-fg" : "border-line text-fg-3 hover:text-fg")}>{u}</button>;
      })}
    </div>
  );
}

export function NewMember({ roles }: { roles: Role[] }) {
  const [role, setRole] = useState(roles.find((r) => r.slug === "leitura")?.slug ?? roles[0]?.slug ?? "");
  const [ufs, setUfs] = useState<string[]>([]);
  const [pw, setPw] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const stepUp = useStepUp();
  const router = useRouter();
  if (pw) return <Panel eyebrow="Membro criado" title="Senha provisória"><Secret label="Senha" value={pw} onDone={() => { setPw(null); router.refresh(); }} /></Panel>;
  return (
    <Panel eyebrow="Novo membro" title="Dar acesso">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await createMember({ email: f.get("email"), full_name: f.get("full_name"), role, ufs });
          if (stepUp(r)) return;
          if (!r.ok) return setErr(r.error);
          setErr(null); setPw(r.data!.password);
        });
      }}>
        {err && <p className="rounded-sm border border-danger/40 bg-danger-soft px-3 py-2 text-danger">{err}</p>}
        <Field label="Nome completo"><input name="full_name" required className={inputCls} /></Field>
        <Field label="E-mail"><input name="email" type="email" required className={inputCls} /></Field>
        <Field label="Papel">
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            {roles.filter((r) => r.slug).map((r) => <option key={r.id} value={r.slug!}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Escopo de UF" hint="Nenhuma marcada = vê todo o Brasil."><UfChooser value={ufs} onChange={setUfs} /></Field>
        <Button variant="primary" disabled={busy}>{busy ? "Criando…" : "Criar acesso"}</Button>
        <p className="text-[11.5px] text-fg-3">Papéis personalizados entram depois, na ficha do membro.</p>
      </form>
    </Panel>
  );
}

export function MemberPanel({ m, roles, sessions, me, canSecurity }: { m: MemberView; roles: Role[]; sessions: Session[]; me: string; canSecurity: boolean }) {
  const [sel, setSel] = useState<string[]>(m.role_ids);
  const [ufs, setUfs] = useState<string[]>(m.ufs ?? []);
  const [pw, setPw] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const stepUp = useStepUp();
  const router = useRouter();
  const self = m.user_id === me;
  const run = (fn: () => Promise<{ ok: boolean; error?: string; stepUp?: boolean }>, okText: string) => start(async () => {
    const r = await fn();
    if (stepUp(r as never)) return;
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Erro" });
    router.refresh();
  });
  const changed = JSON.stringify([...sel].sort()) !== JSON.stringify([...m.role_ids].sort()) || JSON.stringify([...ufs].sort()) !== JSON.stringify([...(m.ufs ?? [])].sort());

  return (
    <aside className="flex h-full w-full flex-col border-l border-line bg-surface xl:w-[400px]">
      <header className="flex items-start justify-between border-b border-line px-4 py-3">
        <div><p className="eyebrow">Membro</p><h2 className="text-[16px] font-semibold">{m.full_name}</h2><p className="text-fg-3">{m.email}</p></div>
        <Link href="?" scroll={false} className="text-fg-3 hover:text-fg" aria-label="Fechar"><X size={16} /></Link>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-3">
        {msg && <p className={msg.ok ? "text-fg-2" : "rounded-sm border border-danger/40 bg-danger-soft px-3 py-2 text-danger"}>{msg.text}</p>}
        {pw && <Secret label="Nova senha provisória" value={pw} onDone={() => setPw(null)} />}
        <section>
          <KV k="Status" v={m.status === "active" ? "ativo" : "suspenso"} />
          <KV k="Autenticador" v={m.totp ? "configurado" : "pendente"} />
          <KV k="Criado em" v={dateTime(m.created_at)} />
          <KV k="Último acesso" v={m.last_seen_at ? ago(m.last_seen_at) : "nunca"} />
        </section>
        {self ? <p className="text-fg-3">Seu próprio acesso só pode ser alterado por outro admin.</p> : (
          <>
            <section>
              <p className="eyebrow mb-2">Papéis</p>
              <div className="space-y-1">
                {roles.map((r) => (
                  <label key={r.id} className={cx("flex items-center gap-2", r.slug === "owner" && !canSecurity && "opacity-50")}>
                    <input type="checkbox" disabled={r.slug === "owner" && !canSecurity} checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} />{r.name}
                  </label>
                ))}
              </div>
            </section>
            <section>
              <p className="eyebrow mb-2">Escopo de UF</p>
              <UfChooser value={ufs} onChange={setUfs} />
              <p className="mt-1 text-[11.5px] text-fg-3">{ufs.length ? `Vê só ${ufs.join(", ")}.` : "Vê todo o Brasil."}</p>
            </section>
            <Button variant="primary" disabled={busy || !changed} onClick={() => run(() => updateMemberAccess(m.user_id, sel, ufs), "Acesso atualizado.")}>Salvar acesso</Button>
            <section className="space-y-2 border-t border-line pt-4">
              <p className="eyebrow">Segurança</p>
              <div className="flex flex-wrap gap-2">
                {m.status === "active"
                  ? <Button variant="danger" disabled={busy} onClick={() => confirm(`Suspender ${m.full_name}? O acesso cai na hora.`) && run(() => setMemberStatus(m.user_id, "suspended"), "Membro suspenso.")}>Suspender</Button>
                  : <Button disabled={busy} onClick={() => run(() => setMemberStatus(m.user_id, "active"), "Membro reativado.")}>Reativar</Button>}
                <Button disabled={busy} onClick={() => confirm("Gerar nova senha provisória? As sessões dele são encerradas.") && start(async () => { const r = await resetPassword(m.user_id); if (stepUp(r)) return; if (r.ok) setPw(r.data!.password); else setMsg({ ok: false, text: r.error }); router.refresh(); })}>Nova senha provisória</Button>
                {canSecurity && m.totp && <Button variant="danger" disabled={busy} onClick={() => confirm("Zerar o autenticador? A pessoa configura de novo no próximo login.") && run(() => resetMfa(m.user_id), "Autenticador zerado e sessões encerradas.")}>Zerar autenticador</Button>}
              </div>
            </section>
          </>
        )}
        <section className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between"><p className="eyebrow">Sessões ({sessions.length})</p>
            {canSecurity && !self && sessions.length > 0 && <button className="eyebrow hover:text-fg" disabled={busy} onClick={() => run(() => endSessions(m.user_id), "Sessões encerradas.")}>encerrar todas</button>}
          </div>
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-sm border border-line px-3 py-2">
                <p className="truncate text-[12px]">{s.user_agent?.replace(/\(.*?\)/g, "").slice(0, 60) ?? "—"}</p>
                <p className="mono text-[11px] text-fg-3">{s.ip ?? "—"} · {s.aal} · {s.refreshed_at ? ago(s.refreshed_at) : dateTime(s.created_at)}{s.current ? " · esta sessão" : ""}</p>
              </li>
            ))}
            {!sessions.length && <p className="text-fg-3">Nenhuma sessão ativa.</p>}
          </ul>
        </section>
        {!self && <Chip tone="outline">toda mudança aqui entra na auditoria</Chip>}
      </div>
    </aside>
  );
}
