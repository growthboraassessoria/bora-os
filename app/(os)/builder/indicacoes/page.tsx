import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { rpc, SITE_ID } from "@/lib/builder";
import { boraId, num, pct, ratio } from "@/lib/format";
import { PageHead, Panel, Stat, Empty, th, td, cx } from "@/components/ui";
import { UfPicker } from "@/components/builder/Filters";
import { CodeSearch } from "./CodeSearch";

export const metadata = { title: "Indicações" };

type Ref = { id: string; bora_number: number; name: string; city: string; state: string; code: string; direct: number; network: number; clicks: number; founders: number };
type Node = { id: string; bora_number: number; name: string; code: string; parent: string | null; depth: number; city: string; state: string };

function Tree({ nodes }: { nodes: Node[] }) {
  const kids = new Map<string, Node[]>();
  for (const n of nodes) if (n.parent) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n]);
  const root = nodes.find((n) => n.depth === 0);
  if (!root) return <Empty title="Código não encontrado." />;
  const render = (n: Node, last: boolean, prefix: string): React.ReactNode[] => {
    const children = kids.get(n.code) ?? [];
    const line = (
      <li key={n.id} className="flex items-center gap-2 py-0.5">
        <span className="mono whitespace-pre text-line-strong">{prefix}{n.depth ? (last ? "└─ " : "├─ ") : ""}</span>
        <Link href={`/builder/cadastros?id=${n.id}`} className={cx("hover:underline", n.depth === 0 ? "font-semibold text-fg" : "text-fg-2")}>{n.name}</Link>
        <span className="mono text-[11px] text-fg-3">{boraId(n.bora_number)} · {n.code}</span>
        <span className="text-fg-3">{n.city} {n.state}</span>
        {children.length > 0 && <span className="mono text-[11px] text-signal-text">+{children.length}</span>}
      </li>
    );
    const next = n.depth ? prefix + (last ? "   " : "│  ") : "";
    return [line, ...children.flatMap((c, i) => render(c, i === children.length - 1, next))];
  };
  return <ul className="text-[12.5px]">{render(root, true, "")}</ul>;
}

export default async function Indicacoes({ searchParams }: { searchParams: Promise<{ uf?: string; codigo?: string }> }) {
  const a = await requirePerm("builder.referrals.read");
  const sp = await searchParams;
  const data = await rpc<{ rows: Ref[]; totals: { leads: number; referred: number; referrers: number } }>(a.db, "referrers", { f: { uf: sp.uf || null, site_id: SITE_ID, limit: 100 } });
  const tree = sp.codigo ? await rpc<Node[]>(a.db, "referral_tree", { p_code: sp.codigo }).catch(() => []) : null;
  const t = data.totals;

  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="Builder · Indicações" title="Quem traz quem" desc="Ranking de quem mais trouxe gente, a rede em todos os níveis e a árvore de cada código." right={<UfPicker value={sp.uf} allowed={a.ufs} />} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Cadastros por indicação" value={num(t.referred)} />
        <Stat label="Parcela da base" value={pct(ratio(t.referred, t.leads))} />
        <Stat label="Pessoas que indicaram" value={num(t.referrers)} />
        <Stat label="Média por indicador" value={t.referrers ? (t.referred / t.referrers).toFixed(1).replace(".", ",") : "—"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Panel eyebrow="Ranking" title="Maiores indicadores" pad={false} className="xl:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr>
                <th className={th}>#</th><th className={th}>Pessoa</th><th className={th}>Código</th>
                <th className={`${th} text-right`}>Diretos</th><th className={`${th} text-right`}>Rede</th><th className={`${th} text-right`}>Cliques</th><th className={`${th} text-right`}>Conv.</th><th className={`${th} text-right`}>Fundadores</th>
              </tr></thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.id} className={cx("hover:bg-surface-2", sp.codigo === r.code && "bg-surface-2")}>
                    <td className={`${td} num text-fg-3`}>{i + 1}</td>
                    <td className={td}><Link href={`/builder/cadastros?id=${r.id}`} className="hover:underline">{r.name}</Link> <span className="text-fg-3">· {r.city} {r.state}</span></td>
                    <td className={`${td} mono`}><Link href={`?${new URLSearchParams({ ...(sp.uf ? { uf: sp.uf } : {}), codigo: r.code })}`} scroll={false} className="text-fg-2 hover:text-fg">{r.code}</Link></td>
                    <td className={`${td} num text-right text-fg`}>{num(r.direct)}</td>
                    <td className={`${td} num text-right`}>{num(r.network)}</td>
                    <td className={`${td} num text-right text-fg-2`}>{num(r.clicks)}</td>
                    <td className={`${td} num text-right text-fg-3`}>{r.clicks >= r.direct ? pct(ratio(r.direct, r.clicks), 0) : "—"}</td>
                    <td className={`${td} num text-right`}>{r.founders ? num(r.founders) : <span className="text-fg-3">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.rows.length && <Empty title="Ninguém indicou ainda." />}
        </Panel>

        <Panel eyebrow="Árvore" title={sp.codigo ? `Rede de ${sp.codigo.toUpperCase()}` : "Escolha um código"} className="xl:col-span-2" right={<CodeSearch value={sp.codigo} />}>
          {tree ? <div className="max-h-[560px] overflow-auto"><Tree nodes={tree} /></div> : <p className="text-fg-3">Clique num código do ranking ou digite um código para ver quem entrou por ele, em todos os níveis.</p>}
        </Panel>
      </div>
    </div>
  );
}
