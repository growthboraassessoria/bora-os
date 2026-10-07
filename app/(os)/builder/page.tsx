import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { rpc, SITE_ID } from "@/lib/builder";
import { num, pct, ratio, dec, periodRange } from "@/lib/format";
import { PageHead, Panel, Stat, Bar, Empty, th, td, Chip } from "@/components/ui";
import { PeriodPicker, UfPicker } from "@/components/builder/Filters";
import { DailyChart } from "@/components/builder/Charts";

export const metadata = { title: "Painel" };

type K = Record<string, number | null>;
type Dash = {
  events_visible: boolean;
  kpis: K;
  series: { day: string; leads: number; referred: number; visitors: number | null }[];
  funnel: { step: string; label: string; n: number }[] | null;
  sources: { source: string; medium: string; leads: number; referred: number }[];
  cities: { slug: string; city: string; uf: string; leads: number; total: number }[];
  experiment: { variant: string; leads: number; visitors: number | null }[];
};

export default async function Painel({ searchParams }: { searchParams: Promise<{ p?: string; uf?: string }> }) {
  const a = await requirePerm("builder.dashboard.read");
  const sp = await searchParams;
  const period = periodRange(sp.p);
  const d = await rpc<Dash>(a.db, "dashboard", { f: { site_id: SITE_ID, from: period.from, to: period.to, uf: sp.uf || null } });
  const k = d.kpis;
  const conv = ratio(k.leads, k.visitors);
  const maxFunnel = d.funnel?.[0]?.n ?? 0;
  const maxCity = Math.max(1, ...d.cities.map((c) => c.leads));

  return (
    <div className="p-4 md:p-6">
      <PageHead
        eyebrow="Builder · LP Vamos em Frente"
        title="Painel"
        desc={`Tudo o que a LP entregou nos últimos ${period.label.toLowerCase()}, comparado ao período anterior de mesmo tamanho.`}
        right={<><UfPicker value={sp.uf} allowed={a.ufs} /><PeriodPicker value={period.id} /></>}
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="Visitantes" value={num(k.visitors)} cur={k.visitors} prev={k.visitors_prev} hint="Navegadores distintos com page_view no período." />
        <Stat label="Cadastros" value={num(k.leads)} cur={k.leads} prev={k.leads_prev} signal hint="Cadastros novos no período." />
        <Stat label="Conversão" value={pct(conv)} hint="Cadastros ÷ visitantes." />
        <Stat label="Por indicação" value={pct(ratio(k.referred, k.leads))} hint="Cadastros com código de quem indicou ÷ cadastros." />
        <Stat label="Fator K" value={dec(k.k_factor)} hint="Cadastros trazidos por quem entrou no período ÷ cadastros do período." />
        <Stat label="Compartilhamentos" value={num(k.shares)} cur={k.shares} prev={k.shares_prev} hint="Eventos share_whatsapp, share_instagram e share_copy." />
        <Stat label="Cliques em links" value={num(k.ref_clicks)} cur={k.ref_clicks} prev={k.ref_clicks_prev} hint="Visitas por link pessoal de indicação." />
        <Stat label="Responderam" value={pct(ratio(k.answered, k.leads))} hint="Cadastros do período com ao menos uma resposta da qualificação." />
        <Stat label="Fundadores" value={num(k.founders)} hint="Fundadores ativos, desde o início." />
        <Stat label="BORA IDs ativos" value={num(k.active_ids)} hint="Evento ou Fundador ativo nos últimos 30 dias." />
        <Stat label="Base total" value={num(k.total_leads)} hint="Todos os cadastros, desde o início." />
        <Stat label="Cidades · UFs" value={`${num(k.cities)} · ${num(k.states)}`} hint="Cidades e estados com ao menos um cadastro." />
      </div>

      {!d.events_visible && (
        <p className="mt-3 rounded-sm border border-line bg-surface px-3 py-2 text-fg-3">
          Visitas, funil e compartilhamentos não têm UF. Eles aparecem só sem filtro de UF e para quem tem permissão de analytics sem escopo.
        </p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Cadastros por dia" title="Diretos e por indicação" className="xl:col-span-2"
          right={<span className="mono flex items-center gap-3 text-[11px] text-fg-3"><span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-[var(--chart-1)]" />indicação</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-[var(--chart-3)]" />diretos</span></span>}>
          {d.series.length ? <DailyChart data={d.series} /> : <Empty title="Sem cadastros no período." />}
        </Panel>

        <Panel eyebrow="Funil" title="Da visita à indicação">
          {d.funnel ? (
            <ol className="space-y-3">
              {d.funnel.map((s, i) => (
                <li key={s.step}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-fg-2">{s.label}</span>
                    <span className="num text-fg">{num(s.n)} {i > 0 && <span className="text-fg-3">· {pct(ratio(s.n, d.funnel![i - 1].n))}</span>}</span>
                  </div>
                  <Bar value={s.n} max={maxFunnel} />
                </li>
              ))}
            </ol>
          ) : <Empty title="Funil indisponível com filtro de UF." />}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Origem" title="Fontes dos cadastros" pad={false} right={<Link href="/builder/origem" className="eyebrow hover:text-fg">ver tudo →</Link>}>
          <table className="w-full">
            <thead><tr><th className={th}>Fonte · meio</th><th className={`${th} text-right`}>Cadastros</th><th className={`${th} text-right`}>Indic.</th></tr></thead>
            <tbody>
              {d.sources.map((s) => (
                <tr key={s.source + s.medium} className="hover:bg-surface-2">
                  <td className={td}>{s.source} <span className="text-fg-3">· {s.medium}</span></td>
                  <td className={`${td} num text-right`}>{num(s.leads)}</td>
                  <td className={`${td} num text-right text-fg-3`}>{pct(ratio(s.referred, s.leads), 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.sources.length && <Empty title="Sem cadastros no período." />}
        </Panel>

        <Panel eyebrow="Cidades" title="Quem mais cresceu no período" pad={false} right={<Link href="/builder/cidades" className="eyebrow hover:text-fg">ranking →</Link>}>
          <ul>
            {d.cities.map((c, i) => (
              <li key={c.slug} className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-0">
                <span className="num w-5 text-fg-3">{i + 1}</span>
                <span className="w-36 truncate text-fg">{c.city} <span className="text-fg-3">{c.uf}</span></span>
                <Bar value={c.leads} max={maxCity} className="flex-1" />
                <span className="num w-10 text-right">{num(c.leads)}</span>
              </li>
            ))}
          </ul>
          {!d.cities.length && <Empty title="Sem cadastros no período." />}
        </Panel>

        <Panel eyebrow="Teste A/B" title="Manchete da página inicial" pad={false}>
          <table className="w-full">
            <thead><tr><th className={th}>Variante</th><th className={`${th} text-right`}>Visitantes</th><th className={`${th} text-right`}>Cadastros</th><th className={`${th} text-right`}>Conv.</th></tr></thead>
            <tbody>
              {d.experiment.map((e) => {
                const best = d.experiment.every((o) => ratio(o.leads, o.visitors) == null || (ratio(e.leads, e.visitors) ?? 0) >= (ratio(o.leads, o.visitors) ?? 0));
                return (
                  <tr key={e.variant}>
                    <td className={td}><span className="mono">{e.variant}</span> {best && d.experiment.length > 1 && e.visitors ? <Chip tone="signal" className="ml-1">à frente</Chip> : null}</td>
                    <td className={`${td} num text-right`}>{num(e.visitors)}</td>
                    <td className={`${td} num text-right`}>{num(e.leads)}</td>
                    <td className={`${td} num text-right`}>{pct(ratio(e.leads, e.visitors))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-3 text-[12px] text-fg-3">Visitantes por variante dependem de a LP enviar a variante no page_view.</p>
        </Panel>
      </div>
    </div>
  );
}
