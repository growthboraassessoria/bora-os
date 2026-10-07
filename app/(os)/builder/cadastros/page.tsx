import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { rpc, type LeadRow, type LeadDetail } from "@/lib/builder";
import { filtersFrom } from "@/lib/leadFilters";
import { boraId, num, date, phone } from "@/lib/format";
import { Chip, Empty, th, td, cx } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { LeadFilters } from "./LeadFilters";
import { Inspector } from "./Inspector";

export const metadata = { title: "Cadastros" };
const PAGE = 50;

type SP = Record<string, string | undefined>;

function href(sp: SP, patch: SP) {
  const n = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) n.set(k, v);
  return `?${n}`;
}

function SortTh({ sp, col, children, className }: { sp: SP; col: string; children: React.ReactNode; className?: string }) {
  const on = (sp.sort ?? "created_at") === col;
  const dir = on && (sp.dir ?? "desc") === "desc" ? "asc" : "desc";
  return (
    <th className={cx(th, className)}>
      <Link href={href(sp, { sort: col, dir, page: undefined })} scroll={false} className={cx("hover:text-fg", on && "text-fg-2")}>
        {children}{on ? ((sp.dir ?? "desc") === "desc" ? " ↓" : " ↑") : ""}
      </Link>
    </th>
  );
}

export default async function Cadastros({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requirePerm("builder.leads.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  let error: string | null = null;
  let res: { total: number; rows: LeadRow[]; pii: boolean } = { total: 0, rows: [], pii: false };
  try {
    res = await rpc(a.db, "search_leads", { f: { ...filtersFrom(sp), limit: PAGE, offset: (page - 1) * PAGE } });
  } catch (e) {
    error = (e as Error).message.includes("pii") ? "Buscar por e-mail, telefone ou CPF exige a permissão de dados pessoais." : "Não foi possível buscar agora.";
  }
  const selected = sp.id ? await rpc<LeadDetail | null>(a.db, "get_lead", { p_id: sp.id, p_reveal: false }).catch(() => null) : null;
  const pages = Math.max(1, Math.ceil(res.total / PAGE));
  const closeHref = href(sp, { id: undefined });

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-line p-4 md:px-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Builder · Cadastros</p>
              <h1 className="mt-1 text-[20px] font-semibold tracking-tight">{num(res.total)} {res.total === 1 ? "cadastro" : "cadastros"}</h1>
            </div>
            <Chip tone="outline">contato mascarado{a.perms.has("builder.leads.pii") ? " · revele na ficha" : ""}</Chip>
          </div>
          <LeadFilters sp={sp} allowed={a.ufs} canPii={a.perms.has("builder.leads.pii")} canCreate={a.perms.has("builder.leads.create")} canExport={a.perms.has("builder.leads.export")} total={res.total} />
          {error && <p className="mt-2 text-danger">{error}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[920px]">
            <thead className="sticky top-0 z-10 bg-bg">
              <tr>
                <SortTh sp={sp} col="bora_number">BORA ID</SortTh>
                <SortTh sp={sp} col="first_name">Nome</SortTh>
                <SortTh sp={sp} col="city">Cidade</SortTh>
                <th className={th}>WhatsApp</th>
                <th className={th}>Origem</th>
                <th className={`${th} text-right`}>Indicou</th>
                <th className={th}>Sinais</th>
                <SortTh sp={sp} col="created_at" className="text-right">Entrou</SortTh>
              </tr>
            </thead>
            <tbody>
              {res.rows.map((r) => {
                const on = sp.id === r.id;
                return (
                  <tr key={r.id} className={cx("group relative hover:bg-surface-2", on && "bg-surface-2")}>
                    <td className={`${td} mono text-fg-3`}>
                      {on && <span className="absolute inset-y-0 left-0 w-[2px] bg-active" />}
                      <Link href={href(sp, { id: r.id })} scroll={false} className="after:absolute after:inset-0">{boraId(r.bora_number)}</Link>
                    </td>
                    <td className={`${td} max-w-[240px] text-fg`}><span className="flex items-center gap-2">{!r.anonymized_at && <Avatar url={r.photo_url} name={`${r.first_name} ${r.last_name}`} size={22} />}<span className="truncate">{r.anonymized_at ? <span className="text-fg-3">Anonimizado</span> : `${r.first_name} ${r.last_name}`}</span></span></td>
                    <td className={td}>{r.city} <span className="text-fg-3">{r.state}</span></td>
                    <td className={`${td} mono text-fg-2`}>{phone(r.phone)}</td>
                    <td className={td}>{r.referred_by ? <span>indicação <span className="mono text-fg-3">{r.referred_by}</span></span> : <span className="text-fg-2">{r.utm.source ?? "(direto)"}</span>}</td>
                    <td className={`${td} num text-right`}>{r.direct ? num(r.direct) : <span className="text-fg-3">—</span>}</td>
                    <td className={td}>
                      <span className="flex gap-1">
                        {r.founder && <Chip tone="signal">fundador</Chip>}
                        {r.answered && <Chip>respondeu</Chip>}
                        {r.source !== "lp" && <Chip tone="outline">{r.source}</Chip>}
                        {(r.tags ?? []).slice(0, 2).map((t) => <Chip key={t} tone="outline">{t}</Chip>)}
                      </span>
                    </td>
                    <td className={`${td} mono text-right text-fg-3`}>{date(r.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!res.rows.length && !error && <Empty title="Nenhum cadastro com esses filtros." />}
        </div>

        <div className="flex h-11 shrink-0 items-center justify-between border-t border-line px-4 md:px-6">
          <p className="mono text-[11px] text-fg-3">página {page} de {pages}</p>
          <div className="flex gap-1">
            <Link aria-disabled={page <= 1} href={href(sp, { page: String(page - 1) })} scroll={false} className={cx("rounded-sm border border-line-strong px-2.5 py-1 text-[12px]", page <= 1 && "pointer-events-none opacity-40")}>Anterior</Link>
            <Link aria-disabled={page >= pages} href={href(sp, { page: String(page + 1) })} scroll={false} className={cx("rounded-sm border border-line-strong px-2.5 py-1 text-[12px]", page >= pages && "pointer-events-none opacity-40")}>Próxima</Link>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-30 xl:static xl:z-auto">
          <Inspector key={selected.id + (selected.updated_at ?? "")} lead={selected} closeHref={closeHref}
            perms={{ edit: a.perms.has("builder.leads.edit"), anonymize: a.perms.has("builder.leads.anonymize"), pii: a.perms.has("builder.leads.pii") }} />
        </div>
      )}
    </div>
  );
}
