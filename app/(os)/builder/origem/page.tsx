import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { SITE_ID } from "@/lib/builder";
import { num, pct, ratio, periodRange, delta as deltaOf } from "@/lib/format";
import { PageHead, Panel, Empty, Stat, Bar, Chip, th, td, cx } from "@/components/ui";
import { PeriodPicker, UfPicker } from "@/components/builder/Filters";
import { OriginSeries } from "@/components/builder/Charts";
import { TouchToggle } from "./TouchToggle";
import { UtmBuilder } from "./UtmBuilder";
import { CHANNEL_LABEL, CHANNEL_ORDER, originInsights } from "./insights";
import { loadOrigins } from "./load";

export const metadata = { title: "Origem" };

type Sp = { p?: string; toque?: string; uf?: string; fonte?: string };

function qs(sp: Sp, patch: Partial<Record<keyof Sp, string | null>> = {}) {
  const next: Record<string, string | undefined> = { p: sp.p, toque: sp.toque, uf: sp.uf, fonte: sp.fonte };
  for (const [k, v] of Object.entries(patch)) next[k] = v ?? undefined;
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `/builder/origem?${s}` : "/builder/origem";
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const d = deltaOf(cur, prev);
  if (prev === 0 && cur > 0) return <span className="text-fg-3">novo</span>;
  if (d == null) return null;
  return <span className="text-fg-3">{d > 0 ? "▲" : d < 0 ? "▼" : "■"} {pct(Math.abs(d), 0)}</span>;
}

function MixBar({ parts }: { parts: { key: string; n: number }[] }) {
  const total = parts.reduce((s, p) => s + p.n, 0);
  if (!total) return <div className="h-2 rounded-xs bg-surface-3" />;
  const top = parts[0]?.key;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-xs bg-surface-3" role="img" aria-label="Mix de canais">
      {parts.filter((p) => p.n > 0).map((p) => (
        <div
          key={p.key}
          title={`${CHANNEL_LABEL[p.key] ?? p.key}: ${p.n}`}
          className={p.key === top ? "bg-active" : "bg-fg-3"}
          style={{ width: `${(p.n / total) * 100}%`, opacity: p.key === top ? 1 : 0.4 }}
        />
      ))}
    </div>
  );
}

export default async function Origem({ searchParams }: { searchParams: Promise<Sp> }) {
  const a = await requirePerm("builder.analytics.read");
  const sp = await searchParams;
  const period = periodRange(sp.p);
  const touch = sp.toque === "primeiro" ? "first" : "last";
  const [d, site] = await Promise.all([
    loadOrigins(a, { from: period.from, to: period.to, touch, uf: sp.uf, fonte: sp.fonte }),
    a.db.schema("builder").from("sites").select("production_url").eq("id", SITE_ID).maybeSingle(),
  ]);
  const k = d.kpis;
  const total = k.leads;
  const insights = originInsights(d, period.label);
  const channels = CHANNEL_ORDER
    .map((id) => d.channels.find((c) => c.channel === id))
    .filter((c): c is NonNullable<typeof c> => !!c && c.leads > 0);
  const mix = [...d.channels].sort((x, y) => y.leads - x.leads);
  const maxSrc = d.by_source[0]?.leads ?? 0;
  const maxMed = d.by_medium[0]?.leads ?? 0;
  const maxUf = d.by_uf[0]?.leads ?? 0;
  const maxCamp = d.by_campaign[0]?.leads ?? 0;
  const prod = site.data?.production_url;
  const base = (prod?.includes("cpn.boraassessoria.com") ? prod : "https://cpn.boraassessoria.com").replace(/\/?$/, "/");
  const conv = ratio(k.leads, k.visitors);
  const aSame = d.attribution;

  return (
    <div className="p-4 md:p-6">
      <PageHead
        eyebrow="Builder · Origem"
        title="De onde vêm os cadastros"
        desc="Fonte, meio, campanha e conteúdo. O último toque é o link da hora do cadastro; o primeiro, o da primeira visita. Visitantes seguem o UTM da visita."
        right={<><UfPicker value={sp.uf} allowed={a.ufs} /><TouchToggle value={d.touch} /><PeriodPicker value={period.id} /></>}
      />

      {sp.fonte && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-fg-2">
          <Chip tone="signal">fonte {sp.fonte}</Chip>
          <Link href={qs(sp, { fonte: null })} className="eyebrow hover:text-fg">limpar filtro</Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-8">
        <Stat label="Cadastros" value={num(k.leads)} cur={k.leads} prev={k.leads_prev} signal hint="Cadastros novos no período, no toque selecionado." />
        <Stat label="Visitantes" value={num(k.visitors)} cur={k.visitors} prev={k.visitors_prev} hint="Navegadores distintos com page_view. Só aparece sem filtro de UF." />
        <Stat label="Conversão" value={pct(conv)} hint="Cadastros ÷ visitantes." />
        <Stat label="Com UTM" value={pct(ratio(k.identified, total), 0)} cur={k.identified} prev={k.identified_prev} hint="Cadastros cuja fonte não é (direto)." />
        <Stat label="Por indicação" value={pct(ratio(k.referred, total), 0)} cur={k.referred} prev={k.referred_prev} hint="Cadastros com código de quem indicou." />
        <Stat label="Responderam" value={pct(ratio(k.answered, total), 0)} hint="Cadastros do período com ao menos uma resposta da qualificação." />
        <Stat label="Fontes" value={num(k.sources)} hint="Fontes distintas com ao menos um cadastro." />
        <Stat label="Campanhas" value={num(k.campaigns)} hint="utm_campaign distintos e preenchidos." />
      </div>

      {!d.events_visible && (
        <p className="mt-3 rounded-sm border border-line bg-surface px-3 py-2 text-fg-3">
          Visitas, conversão por fonte e páginas de entrada não têm UF. Elas aparecem só sem filtro de UF e para quem tem analytics sem escopo.
        </p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Leitura" title="O que os números dizem" className="xl:col-span-2">
          <ol className="space-y-3">
            {insights.map((i) => (
              <li key={i.kicker} className="border-b border-line pb-3 last:border-0 last:pb-0">
                <p className="eyebrow">{i.kicker}</p>
                <p className="mt-1 text-fg-2">{i.text}</p>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel eyebrow="Canais" title={`${num(total)} cadastros no mix`}>
          <MixBar parts={mix.map((c) => ({ key: c.channel, n: c.leads }))} />
          <ul className="mt-3 space-y-2.5">
            {(channels.length ? channels : []).map((c) => (
              <li key={c.channel}>
                <div className="mb-1 flex justify-between gap-2">
                  <span>{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                  <span className="num text-fg-2">{num(c.leads)} <span className="text-fg-3">· {pct(ratio(c.leads, total), 0)}</span></span>
                </div>
                <Bar value={c.leads} max={mix[0]?.leads ?? 0} />
              </li>
            ))}
          </ul>
          {!mix.length && <Empty title="Sem cadastros no período." />}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Fontes" title={d.touch === "first" ? "Primeiro toque" : "Último toque"}>
          <ul className="space-y-2.5">
            {d.by_source.map((s) => {
              const on = sp.fonte === s.source;
              return (
                <li key={s.source}>
                  <Link href={qs(sp, { fonte: on ? null : s.source })} className={cx("block rounded-sm px-1 py-0.5 hover:bg-surface-2", on && "bg-surface-2")}>
                    <div className="mb-1 flex justify-between gap-2">
                      <span className={on ? "text-fg" : ""}>{s.source}</span>
                      <span className="num">{num(s.leads)} <span className="text-fg-3">· {pct(ratio(s.leads, total), 0)}</span> <Delta cur={s.leads} prev={s.leads_prev} /></span>
                    </div>
                    <Bar value={s.leads} max={maxSrc} />
                    <p className="mt-1 num text-[11px] text-fg-3">
                      {pct(ratio(s.leads, s.visitors))} conv. · {pct(ratio(s.answered, s.leads), 0)} resp. · {pct(ratio(s.referred, s.leads), 0)} indic.
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
          {!d.by_source.length && <Empty title="Sem cadastros no período." />}
        </Panel>

        <Panel eyebrow={d.grain === "hour" ? "Por hora" : "Por dia"} title="Com UTM e direto" className="xl:col-span-2"
          right={<span className="mono flex items-center gap-3 text-[11px] text-fg-3"><span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-[var(--chart-1)]" />com UTM</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-[var(--chart-3)]" />direto</span></span>}>
          {d.series.some((s) => s.leads > 0) ? <OriginSeries data={d.series} grain={d.grain} /> : <Empty title="Sem cadastros no período." />}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Jornada" title="Primeiro toque → último toque"
          right={<span className="num text-[11px] text-fg-3">{num(aSame.changed)} mudaram · {num(aSame.same)} iguais</span>}>
          <p className="mb-3 text-[12px] text-fg-3">Independente do toque selecionado: compara a primeira visita com o cadastro.</p>
          <ul className="space-y-2">
            {d.journeys.map((j) => (
              <li key={`${j.first}→${j.last}`} className="flex items-center justify-between gap-2 border-b border-line py-1.5 last:border-0">
                <span className="min-w-0 truncate">
                  <span className="text-fg">{j.first}</span>
                  <span className="mx-1.5 text-fg-3">→</span>
                  <span className="text-fg">{j.last}</span>
                  {j.assisted && <Chip tone="outline" className="ml-2">assistido</Chip>}
                </span>
                <span className="num shrink-0">{num(j.n)} <span className="text-fg-3">· {pct(ratio(j.n, total), 0)}</span></span>
              </li>
            ))}
          </ul>
          {!d.journeys.length && <Empty title="Sem jornada no período." />}
        </Panel>

        <Panel eyebrow="Meios" title="utm_medium">
          <ul className="space-y-2.5">
            {d.by_medium.map((m) => (
              <li key={m.medium}>
                <div className="mb-1 flex justify-between gap-2">
                  <span className="mono text-[12px]">{m.medium}</span>
                  <span className="num">{num(m.leads)} <span className="text-fg-3">· {pct(ratio(m.leads, total), 0)}</span></span>
                </div>
                <Bar value={m.leads} max={maxMed} />
                <p className="mt-1 num text-[11px] text-fg-3">{pct(ratio(m.leads, m.visitors))} conv.</p>
              </li>
            ))}
          </ul>
          {!d.by_medium.length && <Empty title="Sem meios no período." />}
        </Panel>

        <Panel eyebrow="Praças" title="Onde cada fonte converte" pad={false}>
          <ul>
            {d.by_uf.map((u) => (
              <li key={u.uf} className="flex items-center gap-3 border-b border-line px-4 py-2 last:border-0">
                <span className="mono w-8 text-fg">{u.uf}</span>
                <Bar value={u.leads} max={maxUf} className="flex-1" />
                <span className="num w-8 text-right">{num(u.leads)}</span>
                <span className="w-28 truncate text-right text-[12px] text-fg-3">{u.top_source} {pct(ratio(u.top_leads, u.leads), 0)}</span>
              </li>
            ))}
          </ul>
          {!d.by_uf.length && <Empty title="Sem cadastros no período." />}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Campanhas" title="utm_campaign" pad={false} className={d.by_content.length || (d.paths && d.paths.length) ? "xl:col-span-2" : "xl:col-span-3"}>
          {d.by_campaign.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead><tr>
                  <th className={th}>Campanha</th><th className={th}>Fonte · meio</th>
                  <th className={`${th} w-[28%]`}>Cadastros</th>
                  <th className={`${th} text-right`}>Cad.</th>
                  <th className={`${th} text-right`}>Conv.</th>
                  <th className={`${th} text-right`}>Resp.</th>
                </tr></thead>
                <tbody>
                  {d.by_campaign.map((c) => (
                    <tr key={`${c.campaign}-${c.source}-${c.medium}`} className="hover:bg-surface-2">
                      <td className={`${td} mono text-[12px]`}>{c.campaign}</td>
                      <td className={`${td} text-fg-2`}>{c.source} <span className="text-fg-3">· {c.medium}</span></td>
                      <td className={td}><Bar value={c.leads} max={maxCamp} /></td>
                      <td className={`${td} num text-right`}>{num(c.leads)}</td>
                      <td className={`${td} num text-right text-fg-3`}>{pct(ratio(c.leads, c.visitors))}</td>
                      <td className={`${td} num text-right text-fg-3`}>{pct(ratio(c.answered, c.leads), 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty title="Nenhuma campanha nomeada no período." />}
        </Panel>

        {d.by_content.length > 0 && (
          <Panel eyebrow="Criativos" title="utm_content" pad={false}>
            <ul>
              {d.by_content.map((c) => (
                <li key={`${c.content}-${c.campaign}-${c.source}`} className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2 last:border-0">
                  <span className="min-w-0">
                    <span className="mono text-[12px] text-fg">{c.content}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-fg-3">{c.source} · {c.campaign}</span>
                  </span>
                  <span className="num shrink-0">{num(c.leads)} <span className="text-fg-3">· {pct(ratio(c.leads, c.visitors))}</span></span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {d.paths && d.paths.length > 0 && !d.by_content.length && (
          <Panel eyebrow="Entrada" title="Páginas com visita" pad={false}>
            <ul>
              {d.paths.map((p) => (
                <li key={p.path} className="flex justify-between gap-3 border-b border-line px-4 py-2 last:border-0">
                  <span className="mono truncate text-[12px]">{p.path}</span>
                  <span className="num text-fg-2">{num(p.visitors)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {d.paths && d.paths.length > 0 && d.by_content.length > 0 && (
        <div className="mt-4">
          <Panel eyebrow="Entrada" title="Páginas com visita" pad={false}>
            <ul className="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
              {d.paths.map((p) => (
                <li key={p.path} className="flex justify-between gap-3 border-b border-line px-4 py-2 last:border-0 sm:even:border-l">
                  <span className="mono truncate text-[12px]">{p.path}</span>
                  <span className="num text-fg-2">{num(p.visitors)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <div className="mt-4">
        <Panel eyebrow="Detalhe" title="Fonte, meio, campanha, conteúdo e termo" pad={false}
          right={<span className="num text-[11px] text-fg-3">{num(d.rows.length)} combinações</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead><tr>
                <th className={th}>Fonte</th><th className={th}>Meio</th><th className={th}>Campanha</th>
                <th className={th}>Conteúdo</th><th className={th}>Termo</th>
                <th className={`${th} text-right`}>Visitantes</th><th className={`${th} text-right`}>Cadastros</th>
                <th className={`${th} text-right`}>Δ</th>
                <th className={`${th} text-right`}>Conv.</th>
                <th className={`${th} text-right`}>Resp.</th>
                <th className={`${th} text-right`}>Fund.</th>
                <th className={`${th} text-right`}>Indic.</th>
              </tr></thead>
              <tbody>
                {d.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-surface-2">
                    <td className={td}>
                      <Link href={`/builder/cadastros?origem=${encodeURIComponent(r.source)}`} className="hover:underline">{r.source}</Link>
                    </td>
                    <td className={`${td} text-fg-2`}>{r.medium}</td>
                    <td className={`${td} mono text-[12px] text-fg-2`}>{r.campaign}</td>
                    <td className={`${td} mono text-[12px] text-fg-3`}>{r.content}</td>
                    <td className={`${td} mono text-[12px] text-fg-3`}>{r.term}</td>
                    <td className={`${td} num text-right text-fg-2`}>{num(r.visitors)}</td>
                    <td className={`${td} num text-right`}>{num(r.leads)}</td>
                    <td className={`${td} num text-right`}><Delta cur={r.leads} prev={r.leads_prev} /></td>
                    <td className={`${td} num text-right text-fg-3`}>{pct(ratio(r.leads, r.visitors))}</td>
                    <td className={`${td} num text-right text-fg-3`}>{pct(ratio(r.answered, r.leads), 0)}</td>
                    <td className={`${td} num text-right text-fg-3`}>{num(r.founders)}</td>
                    <td className={`${td} num text-right text-fg-3`}>{pct(ratio(r.referred, r.leads), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!d.rows.length && <Empty title="Sem cadastros no período." />}
        </Panel>
      </div>

      <div className="mt-4"><UtmBuilder base={base} /></div>
    </div>
  );
}
