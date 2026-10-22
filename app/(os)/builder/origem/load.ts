import "server-only";
import type { Db } from "@/lib/supabase/server";
import { rpc, SITE_ID, type LeadRow } from "@/lib/builder";
import { channelOf, type Origins, type OriginRow } from "./insights";

const TZ = "America/Sao_Paulo";

type Auth = { db: Db; perms: Set<string> };

function dim(l: LeadRow, touch: "first" | "last") {
  const t = touch === "first" ? l.first_touch : { utm_source: l.utm?.source, utm_medium: l.utm?.medium, utm_campaign: l.utm?.campaign, utm_content: l.utm?.content, utm_term: l.utm?.term };
  const source = t?.utm_source || "(direto)";
  const medium = t?.utm_medium || "—";
  const campaign = t?.utm_campaign || "—";
  const content = t?.utm_content || "—";
  const term = t?.utm_term || "—";
  return { source, medium, campaign, content, term, channel: channelOf(source, medium) };
}

function parts(iso: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { day: `${g("year")}-${g("month")}-${g("day")}`, hour: g("hour") };
}

function bucketOf(iso: string, grain: "hour" | "day") {
  const p = parts(iso);
  return grain === "hour" ? `${p.day} ${p.hour}:00` : p.day;
}

function buckets(from: string, to: string, grain: "hour" | "day") {
  const out: string[] = [];
  const step = grain === "hour" ? 3600_000 : 86400_000;
  const t0 = new Date(from).getTime();
  const t1 = new Date(to).getTime() - 1;
  const first = bucketOf(new Date(t0).toISOString(), grain);
  const last = bucketOf(new Date(Math.max(t0, t1)).toISOString(), grain);
  let t = t0;
  const seen = new Set<string>();
  while (t <= t1 + step && out.length < 400) {
    const b = bucketOf(new Date(t).toISOString(), grain);
    if (!seen.has(b)) {
      seen.add(b);
      out.push(b);
    }
    if (b === last && t >= t1) break;
    t += step;
  }
  if (!out.includes(first)) out.unshift(first);
  if (!out.includes(last)) out.push(last);
  return out;
}

function inc<K>(map: Map<K, number>, key: K, n = 1) {
  map.set(key, (map.get(key) ?? 0) + n);
}

type LegacyRow = { source: string; medium: string; campaign: string; content: string; term?: string; leads: number; referred: number; visitors: number | null };
type Legacy = { rows: LegacyRow[]; touch: string; events_visible: boolean };
type Payload = Origins | Legacy;

function isNew(d: Payload): d is Origins {
  const o = d as Origins;
  return !!o.kpis && Array.isArray(o.by_source) && Array.isArray(o.journeys) && !!o.attribution;
}

export async function loadOrigins(
  a: Auth,
  opts: { from: string; to: string; touch: "first" | "last"; uf?: string; fonte?: string },
): Promise<Origins> {
  const f = { from: opts.from, to: opts.to, touch: opts.touch, site_id: SITE_ID, uf: opts.uf || null, source: opts.fonte || null };
  const raw = await rpc<Payload>(a.db, "origins", { f });
  if (isNew(raw)) return raw;

  const span = new Date(opts.to).getTime() - new Date(opts.from).getTime();
  const prevFrom = new Date(new Date(opts.from).getTime() - span).toISOString();
  const canLeads = a.perms.has("builder.leads.read");
  const canDash = a.perms.has("builder.dashboard.read");
  const leadF = { site_id: SITE_ID, uf: opts.uf || null, limit: 500, offset: 0 };
  const emptyLeads = { rows: [] as LeadRow[] };
  const [curPack, prevPack, dash] = await Promise.all([
    canLeads ? rpc<{ rows: LeadRow[] }>(a.db, "search_leads", { f: { ...leadF, from: opts.from, to: opts.to } }).catch(() => emptyLeads) : emptyLeads,
    canLeads ? rpc<{ rows: LeadRow[] }>(a.db, "search_leads", { f: { ...leadF, from: prevFrom, to: opts.from } }).catch(() => emptyLeads) : emptyLeads,
    canDash
      ? rpc<{ events_visible: boolean; kpis: Record<string, number | null>; series: { day: string; leads: number; referred: number; visitors: number | null }[] }>(a.db, "dashboard", { f: { site_id: SITE_ID, from: opts.from, to: opts.to, uf: opts.uf || null } }).catch(() => null)
      : null,
  ]);

  let tagged = (curPack.rows ?? []).map((l) => ({ l, d: dim(l, opts.touch) })).filter((x) => !opts.fonte || x.d.source === opts.fonte);
  const taggedPrev = (prevPack.rows ?? []).map((l) => ({ l, d: dim(l, opts.touch) })).filter((x) => !opts.fonte || x.d.source === opts.fonte);
  if (!tagged.length) {
    tagged = (raw.rows ?? []).filter((r) => !opts.fonte || r.source === opts.fonte).flatMap((r) =>
      Array.from({ length: r.leads }, (_, i) => ({
        l: { referred_by: i < r.referred ? "x" : null, answered: false, founder: false, state: "", created_at: opts.to, utm: { source: r.source, medium: r.medium, campaign: r.campaign, content: r.content, term: null }, first_touch: null } as unknown as LeadRow,
        d: { source: r.source, medium: r.medium, campaign: r.campaign, content: r.content, term: r.term || "—", channel: channelOf(r.source, r.medium) },
      })),
    );
  }
  const grain: "hour" | "day" = span <= 36 * 3600_000 ? "hour" : "day";

  const visCombo = new Map<string, number>();
  const visSrc = new Map<string, number>();
  const visMed = new Map<string, number>();
  const visCamp = new Map<string, number>();
  const visCh = new Map<string, number>();
  for (const r of raw.rows ?? []) {
    if (opts.fonte && r.source !== opts.fonte) continue;
    const n = r.visitors ?? 0;
    inc(visCombo, `${r.source}\0${r.medium}\0${r.campaign}`, n);
    inc(visSrc, r.source, n);
    inc(visMed, r.medium, n);
    inc(visCamp, `${r.campaign}\0${r.source}\0${r.medium}`, n);
    inc(visCh, channelOf(r.source, r.medium), n);
  }
  const vis = (map: Map<string, number>, key: string) => (raw.events_visible ? (map.get(key) ?? 0) : null);

  const group = (items: typeof tagged) => {
    const rows = new Map<string, OriginRow>();
    const bySource = new Map<string, { source: string; leads: number; referred: number; answered: number; founders: number }>();
    const byMedium = new Map<string, { medium: string; leads: number; referred: number }>();
    const byCampaign = new Map<string, { campaign: string; source: string; medium: string; leads: number; referred: number; answered: number }>();
    const byContent = new Map<string, { content: string; campaign: string; source: string; leads: number }>();
    const channels = new Map<string, { channel: string; leads: number; referred: number; answered: number }>();
    const uf = new Map<string, Map<string, number>>();
    for (const { l, d } of items) {
      const referred = l.referred_by ? 1 : 0;
      const answered = l.answered ? 1 : 0;
      const founders = l.founder ? 1 : 0;
      const rk = `${d.source}\0${d.medium}\0${d.campaign}\0${d.content}\0${d.term}`;
      const row = rows.get(rk) ?? { source: d.source, medium: d.medium, campaign: d.campaign, content: d.content, term: d.term, leads: 0, referred: 0, answered: 0, founders: 0, leads_prev: 0, visitors: vis(visCombo, `${d.source}\0${d.medium}\0${d.campaign}`) };
      row.leads += 1; row.referred += referred; row.answered += answered; row.founders += founders;
      rows.set(rk, row);
      const s = bySource.get(d.source) ?? { source: d.source, leads: 0, referred: 0, answered: 0, founders: 0 };
      s.leads += 1; s.referred += referred; s.answered += answered; s.founders += founders;
      bySource.set(d.source, s);
      const m = byMedium.get(d.medium) ?? { medium: d.medium, leads: 0, referred: 0 };
      m.leads += 1; m.referred += referred;
      byMedium.set(d.medium, m);
      if (d.campaign !== "—") {
        const ck = `${d.campaign}\0${d.source}\0${d.medium}`;
        const c = byCampaign.get(ck) ?? { campaign: d.campaign, source: d.source, medium: d.medium, leads: 0, referred: 0, answered: 0 };
        c.leads += 1; c.referred += referred; c.answered += answered;
        byCampaign.set(ck, c);
      }
      if (d.content !== "—") {
        const ck = `${d.content}\0${d.campaign}\0${d.source}`;
        const c = byContent.get(ck) ?? { content: d.content, campaign: d.campaign, source: d.source, leads: 0 };
        c.leads += 1;
        byContent.set(ck, c);
      }
      const ch = channels.get(d.channel) ?? { channel: d.channel, leads: 0, referred: 0, answered: 0 };
      ch.leads += 1; ch.referred += referred; ch.answered += answered;
      channels.set(d.channel, ch);
      if (!uf.has(l.state)) uf.set(l.state, new Map());
      inc(uf.get(l.state)!, d.source);
    }
    return { rows, bySource, byMedium, byCampaign, byContent, channels, uf };
  };

  const cur = group(tagged);
  const prevSrc = new Map<string, number>();
  const prevCombo = new Map<string, number>();
  for (const { d } of taggedPrev) {
    inc(prevSrc, d.source);
    inc(prevCombo, `${d.source}\0${d.medium}\0${d.campaign}\0${d.content}\0${d.term}`);
  }
  for (const r of cur.rows.values()) r.leads_prev = prevCombo.get(`${r.source}\0${r.medium}\0${r.campaign}\0${r.content}\0${r.term}`) ?? 0;

  const journeysMap = new Map<string, { first: string; last: string; n: number; assisted: boolean }>();
  let same = 0, changed = 0, firstThenDirect = 0, directThenTagged = 0;
  for (const { l } of tagged) {
    const first = l.first_touch?.utm_source || "(direto)";
    const last = l.utm?.source || "(direto)";
    const assisted = first !== last;
    const k = `${first}\0${last}`;
    const j = journeysMap.get(k) ?? { first, last, n: 0, assisted };
    j.n += 1;
    journeysMap.set(k, j);
    if (assisted) changed += 1; else same += 1;
    if (first !== "(direto)" && last === "(direto)") firstThenDirect += 1;
    if (first === "(direto)" && last !== "(direto)") directThenTagged += 1;
  }

  const seriesCount = new Map<string, { leads: number; referred: number; identified: number }>();
  for (const { l, d } of tagged) {
    const b = bucketOf(l.created_at, grain);
    const s = seriesCount.get(b) ?? { leads: 0, referred: 0, identified: 0 };
    s.leads += 1;
    if (l.referred_by) s.referred += 1;
    if (d.source !== "(direto)") s.identified += 1;
    seriesCount.set(b, s);
  }
  const visDay = new Map<string, number>();
  for (const s of dash?.series ?? []) if (s.visitors != null) visDay.set(s.day, s.visitors);

  const leads = tagged.length;
  const referred = tagged.filter((x) => x.l.referred_by).length;
  const identified = tagged.filter((x) => x.d.source !== "(direto)").length;
  const answered = tagged.filter((x) => x.l.answered).length;
  const founders = tagged.filter((x) => x.l.founder).length;
  const campaigns = new Set(tagged.filter((x) => x.d.campaign !== "—").map((x) => x.d.campaign)).size;
  const media = new Set(tagged.filter((x) => x.d.medium !== "—").map((x) => x.d.medium)).size;
  const visitors = opts.fonte || opts.uf ? (raw.events_visible ? [...visSrc.values()].reduce((s, n) => s + n, 0) : null) : (dash?.kpis.visitors ?? (raw.events_visible ? raw.rows.reduce((s, r) => s + (r.visitors ?? 0), 0) : null));

  const by_uf = [...cur.uf.entries()].map(([uf, srcs]) => {
    const top = [...srcs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const n = [...srcs.values()].reduce((s, x) => s + x, 0);
    return { uf, leads: n, top_source: top?.[0] ?? "(direto)", top_leads: top?.[1] ?? 0 };
  }).sort((a, b) => b.leads - a.leads);

  const sortN = <T extends { leads: number }>(xs: T[]) => xs.sort((a, b) => b.leads - a.leads);

  return {
    touch: opts.touch,
    events_visible: !!raw.events_visible && !opts.uf,
    grain,
    rows: sortN([...cur.rows.values()]),
    kpis: {
      leads,
      leads_prev: taggedPrev.length,
      referred,
      referred_prev: taggedPrev.filter((x) => x.l.referred_by).length,
      identified,
      identified_prev: taggedPrev.filter((x) => x.d.source !== "(direto)").length,
      direct: leads - identified,
      answered,
      founders,
      sources: cur.bySource.size,
      campaigns,
      media,
      visitors,
      visitors_prev: opts.fonte || opts.uf ? null : (dash?.kpis.visitors_prev ?? null),
    },
    channels: sortN([...cur.channels.values()]).map((c) => ({ ...c, visitors: vis(visCh, c.channel) })),
    by_source: sortN([...cur.bySource.values()]).map((s) => ({ ...s, leads_prev: prevSrc.get(s.source) ?? 0, visitors: vis(visSrc, s.source) })),
    by_medium: sortN([...cur.byMedium.values()]).map((m) => ({ ...m, visitors: vis(visMed, m.medium) })),
    by_campaign: sortN([...cur.byCampaign.values()]).map((c) => ({ ...c, visitors: vis(visCamp, `${c.campaign}\0${c.source}\0${c.medium}`) })),
    by_content: sortN([...cur.byContent.values()]).map((c) => ({ ...c, visitors: vis(visSrc, c.source) })),
    series: buckets(opts.from, opts.to, grain).map((at) => {
      const s = seriesCount.get(at) ?? { leads: 0, referred: 0, identified: 0 };
      return { at, ...s, visitors: grain === "day" ? (visDay.get(at) ?? null) : null };
    }),
    journeys: [...journeysMap.values()].sort((a, b) => b.n - a.n).slice(0, 16),
    attribution: { same, changed, first_then_direct: firstThenDirect, direct_then_tagged: directThenTagged },
    by_uf,
    paths: null,
  };
}
