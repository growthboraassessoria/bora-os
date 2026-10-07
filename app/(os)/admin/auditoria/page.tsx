import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { PageHead, Panel, Chip, Empty, th, td, cx } from "@/components/ui";
import { AuditFilters } from "./AuditFilters";

export const metadata = { title: "Auditoria" };
const PAGE = 100;

const ACTION: Record<string, string> = {
  insert: "criou", update: "alterou", delete: "apagou", "pii.revealed": "revelou contato", "leads.exported": "exportou cadastros",
  "auth.login": "entrou", "auth.password_ok": "senha conferida", "auth.mfa_enrolled": "ativou autenticador", "auth.mfa_reset": "zerou autenticador",
  "auth.password_reset": "gerou senha provisória", "sessions.ended": "encerrou sessões",
};
const ENTITY: Record<string, string> = {
  "public.leads": "cadastro", "os.members": "membro", "os.roles": "papel", "os.role_permissions": "permissão de papel", "os.member_roles": "papel de membro",
  "os.member_scopes": "escopo", "os.session": "sessão", "builder.page_versions": "versão de página", "builder.site_settings": "configurações",
  "builder.sites": "site", "builder.lead_notes": "nota", "builder.lead_tags": "etiqueta", "mcp.connections": "conexão MCP", "mcp.tools": "ferramenta MCP",
  "public.states": "estado", "public.testimonials": "depoimento", "public.founder_status": "fundador",
};

export default async function Auditoria({ searchParams }: { searchParams: Promise<{ ator?: string; acao?: string; entidade?: string; page?: string }> }) {
  const a = await requirePerm("admin.audit.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  let q = a.db.schema("os").from("audit_log").select("id,at,actor_type,actor_id,action,entity,entity_id,before,after,meta", { count: "estimated" }).order("at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (sp.ator) q = sp.ator === "lp" || sp.ator === "mcp" || sp.ator === "system" ? q.eq("actor_type", sp.ator) : q.eq("actor_id", sp.ator);
  if (sp.acao) q = q.eq("action", sp.acao);
  if (sp.entidade) q = q.eq("entity", sp.entidade);
  const [{ data: rows, count }, { data: members }, { data: conns }] = await Promise.all([
    q,
    a.db.schema("os").from("members").select("user_id,full_name"),
    a.db.schema("mcp").from("connections").select("id,name"),
  ]);
  const who = new Map<string, string>([...(members ?? []).map((m) => [m.user_id, m.full_name] as [string, string]), ...(conns ?? []).map((c) => [c.id, `MCP: ${c.name}`] as [string, string])]);
  const actor = (t: string, id: string | null) => (t === "lp" ? "LP (cadastro público)" : t === "system" ? "sistema" : (id && who.get(id)) || t);
  const n = (sp2: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...sp, ...sp2 }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="Admin · Auditoria" title="Tudo o que mudou" desc="Registro só de inclusão: ninguém altera nem apaga, nem o proprietário. Dados pessoais aparecem mascarados." />
      <AuditFilters sp={sp} members={(members ?? []).map((m) => ({ id: m.user_id, name: m.full_name }))} actions={ACTION} entities={ENTITY} />
      <Panel pad={false} className="mt-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr><th className={th}>Quando</th><th className={th}>Quem</th><th className={th}>O quê</th><th className={th}>Onde</th><th className={th}>Detalhe</th></tr></thead>
            <tbody>
              {(rows ?? []).map((r) => {
                const changes = r.action === "update" && r.after ? Object.keys(r.after as object).map((k) => `${k}: ${fmt((r.before as Record<string, unknown>)?.[k])} → ${fmt((r.after as Record<string, unknown>)[k])}`).join(" · ") : r.meta && Object.keys(r.meta as object).length ? JSON.stringify(r.meta) : "";
                return (
                  <tr key={r.id} className="align-top hover:bg-surface-2">
                    <td className={`${td} mono text-[12px] text-fg-3`}>{dateTime(r.at)}</td>
                    <td className={td}><Chip tone={r.actor_type === "member" ? "neutral" : "outline"} className="mr-1.5">{r.actor_type}</Chip>{actor(r.actor_type, r.actor_id)}</td>
                    <td className={cx(td, r.action.startsWith("pii") || r.action.includes("export") ? "text-warning" : "text-fg")}>{ACTION[r.action] ?? r.action}</td>
                    <td className={td}>{ENTITY[r.entity] ?? r.entity} {r.entity === "public.leads" && r.entity_id ? <Link className="mono text-[11px] text-fg-3 hover:underline" href={`/builder/cadastros?id=${r.entity_id}`}>abrir</Link> : null}</td>
                    <td className={`${td} mono max-w-[420px] truncate text-[11.5px] text-fg-3`} title={changes}>{changes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!(rows ?? []).length && <Empty title="Nada registrado com esses filtros." />}
        <div className="flex items-center justify-between border-t border-line px-4 py-2">
          <span className="mono text-[11px] text-fg-3">página {page}{count ? ` · ~${count} registros` : ""}</span>
          <div className="flex gap-1">
            {page > 1 && <Link href={n({ page: String(page - 1) })} className="rounded-sm border border-line-strong px-2.5 py-1 text-[12px]">Anterior</Link>}
            {(rows ?? []).length === PAGE && <Link href={n({ page: String(page + 1) })} className="rounded-sm border border-line-strong px-2.5 py-1 text-[12px]">Próxima</Link>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

const fmt = (v: unknown) => (v == null ? "∅" : typeof v === "object" ? "…" : String(v).slice(0, 40));
