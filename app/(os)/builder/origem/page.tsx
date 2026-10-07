import { requirePerm } from "@/lib/auth";
import { rpc, SITE_ID } from "@/lib/builder";
import { num, pct, ratio, periodRange } from "@/lib/format";
import { PageHead, Panel, Empty, th, td, Bar } from "@/components/ui";
import { PeriodPicker } from "@/components/builder/Filters";
import { TouchToggle } from "./TouchToggle";
import { UtmBuilder } from "./UtmBuilder";

export const metadata = { title: "Origem" };
type Row = { source: string; medium: string; campaign: string; content: string; leads: number; referred: number; visitors: number | null };

export default async function Origem({ searchParams }: { searchParams: Promise<{ p?: string; toque?: string }> }) {
  const a = await requirePerm("builder.analytics.read");
  const sp = await searchParams;
  const period = periodRange(sp.p);
  const d = await rpc<{ rows: Row[]; touch: string; events_visible: boolean }>(a.db, "origins", { f: { from: period.from, to: period.to, touch: sp.toque === "primeiro" ? "first" : "last", site_id: SITE_ID } });
  const bySource = new Map<string, number>();
  for (const r of d.rows) bySource.set(r.source, (bySource.get(r.source) ?? 0) + r.leads);
  const sources = [...bySource.entries()].sort((x, y) => y[1] - x[1]);
  const max = sources[0]?.[1] ?? 0;
  const total = d.rows.reduce((s, r) => s + r.leads, 0);

  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="Builder · Origem" title="De onde vêm os cadastros" desc="Por UTM: fonte, meio, campanha e conteúdo. O último toque é o link que trouxe a pessoa na hora do cadastro; o primeiro, o que trouxe na primeira visita."
        right={<><TouchToggle value={d.touch} /><PeriodPicker value={period.id} /></>} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Fontes" title={`${num(total)} cadastros no período`}>
          <ul className="space-y-2.5">
            {sources.map(([s, n]) => (
              <li key={s}>
                <div className="mb-1 flex justify-between"><span>{s}</span><span className="num">{num(n)} <span className="text-fg-3">· {pct(ratio(n, total), 0)}</span></span></div>
                <Bar value={n} max={max} />
              </li>
            ))}
          </ul>
          {!sources.length && <Empty title="Sem cadastros no período." />}
        </Panel>
        <Panel eyebrow="Detalhe" title="Fonte, meio, campanha e conteúdo" pad={false} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr>
                <th className={th}>Fonte</th><th className={th}>Meio</th><th className={th}>Campanha</th><th className={th}>Conteúdo</th>
                <th className={`${th} text-right`}>Visitantes</th><th className={`${th} text-right`}>Cadastros</th><th className={`${th} text-right`}>Conv.</th><th className={`${th} text-right`}>Indic.</th>
              </tr></thead>
              <tbody>
                {d.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-2">
                    <td className={td}>{r.source}</td><td className={`${td} text-fg-2`}>{r.medium}</td>
                    <td className={`${td} mono text-[12px] text-fg-2`}>{r.campaign}</td><td className={`${td} mono text-[12px] text-fg-3`}>{r.content}</td>
                    <td className={`${td} num text-right text-fg-2`}>{num(r.visitors)}</td>
                    <td className={`${td} num text-right`}>{num(r.leads)}</td>
                    <td className={`${td} num text-right text-fg-3`}>{pct(ratio(r.leads, r.visitors))}</td>
                    <td className={`${td} num text-right text-fg-3`}>{pct(ratio(r.referred, r.leads), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <div className="mt-4"><UtmBuilder /></div>
    </div>
  );
}
