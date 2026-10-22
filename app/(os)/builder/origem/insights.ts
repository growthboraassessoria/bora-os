import { pct, ratio } from "@/lib/format";

export const CHANNEL_LABEL: Record<string, string> = {
  social: "Social",
  pago: "Pago",
  organico: "Orgânico",
  indicacao: "Indicação",
  direto: "Direto",
  outro: "Outro",
};

export const CHANNEL_ORDER = ["social", "pago", "organico", "indicacao", "direto", "outro"] as const;

export function channelOf(source: string, medium: string) {
  const med = medium.toLowerCase();
  const src = source.toLowerCase();
  if (["cpc", "ppc", "paid", "cpm", "cpa", "ads", "paid_social", "paid-social", "display"].includes(med)) return "pago";
  if (["referral", "indicacao", "indicação"].includes(med)) return "indicacao";
  if (["social", "organic_social", "social_organic", "social-organic"].includes(med) || ["instagram", "facebook", "meta", "tiktok", "twitter", "x", "linkedin", "youtube", "whatsapp", "threads"].includes(src)) return "social";
  if (["organic", "seo", "email", "newsletter"].includes(med) || ["google", "bing", "yahoo", "duckduckgo"].includes(src)) return "organico";
  if (source === "(direto)") return "direto";
  return "outro";
}

export type OriginKpis = {
  leads: number;
  leads_prev: number;
  referred: number;
  referred_prev: number;
  identified: number;
  identified_prev: number;
  direct: number;
  answered: number;
  founders: number;
  sources: number;
  campaigns: number;
  media: number;
  visitors: number | null;
  visitors_prev: number | null;
};

export type OriginRow = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  leads: number;
  referred: number;
  answered: number;
  founders: number;
  leads_prev: number;
  visitors: number | null;
};

export type OriginSource = {
  source: string;
  leads: number;
  referred: number;
  answered: number;
  founders: number;
  leads_prev: number;
  visitors: number | null;
};

export type Origins = {
  touch: string;
  events_visible: boolean;
  grain: "hour" | "day";
  rows: OriginRow[];
  kpis: OriginKpis;
  channels: { channel: string; leads: number; referred: number; answered: number; visitors: number | null }[];
  by_source: OriginSource[];
  by_medium: { medium: string; leads: number; referred: number; visitors: number | null }[];
  by_campaign: { campaign: string; source: string; medium: string; leads: number; referred: number; answered: number; visitors: number | null }[];
  by_content: { content: string; campaign: string; source: string; leads: number; visitors: number | null }[];
  series: { at: string; leads: number; referred: number; identified: number; visitors: number | null }[];
  journeys: { first: string; last: string; n: number; assisted: boolean }[];
  attribution: { same: number; changed: number; first_then_direct: number; direct_then_tagged: number };
  by_uf: { uf: string; leads: number; top_source: string; top_leads: number }[];
  paths: { path: string; visitors: number }[] | null;
};

export type Insight = { kicker: string; text: string };

export function originInsights(d: Origins, periodLabel: string): Insight[] {
  const k = d.kpis;
  const total = k.leads;
  const out: Insight[] = [];
  const touch = d.touch === "first" ? "primeiro toque" : "último toque";

  if (!total) {
    return [{
      kicker: "Período",
      text: `Nenhum cadastro em ${periodLabel.toLowerCase()}. O gerador de links no fim da página já sai com UTM no padrão da campanha — use-o nas peças para a origem não cair em (direto).`,
    }];
  }

  const directShare = ratio(k.direct, total);
  if (directShare != null && directShare >= 40) {
    out.push({
      kicker: "Sem UTM",
      text: `${pct(directShare, 0)} dos cadastros (${k.direct} de ${total}) chegam como (direto) no ${touch}. O link da peça pode estar saindo sem parâmetro, ou a pessoa digitou o endereço.`,
    });
  } else if (directShare != null && directShare <= 15 && k.identified > 0) {
    out.push({
      kicker: "Atribuição",
      text: `${pct(ratio(k.identified, total), 0)} dos cadastros têm fonte marcada. O ${touch} está conseguindo nomear de onde a pessoa veio.`,
    });
  }

  const top = d.by_source[0];
  if (top && total >= 2 && ratio(top.leads, total) != null && (ratio(top.leads, total) ?? 0) >= 50) {
    out.push({
      kicker: "Concentração",
      text: `${top.source} concentra ${pct(ratio(top.leads, total), 0)} dos cadastros. A campanha depende dessa fonte; vale ter uma segunda via se ela oscilar.`,
    });
  }

  if (d.events_visible && k.visitors && k.visitors > 0) {
    const avg = ratio(total, k.visitors) ?? 0;
    const ranked = [...d.by_source]
      .filter((s) => (s.visitors ?? 0) >= 3)
      .map((s) => ({ ...s, conv: ratio(s.leads, s.visitors) ?? 0 }))
      .sort((a, b) => b.conv - a.conv);
    const best = ranked[0];
    if (best && best.conv > avg * 1.4 && best.conv > 0) {
      out.push({
        kicker: "Conversão",
        text: `${best.source} converte ${pct(best.conv)} (cadastros ÷ visitantes), acima da média de ${pct(avg)}. É a fonte que melhor fecha no período.`,
      });
    } else {
      out.push({
        kicker: "Conversão",
        text: `A LP converteu ${pct(avg)} neste recorte (${total} cadastros em ${k.visitors} visitantes), pelo ${touch}.`,
      });
    }
  }

  if (k.answered > 0) {
    const rate = ratio(k.answered, total);
    const bestQ = [...d.by_source].filter((s) => s.leads >= 2).sort((a, b) => (ratio(b.answered, b.leads) ?? 0) - (ratio(a.answered, a.leads) ?? 0))[0];
    if (bestQ && (ratio(bestQ.answered, bestQ.leads) ?? 0) >= 60) {
      out.push({
        kicker: "Qualidade",
        text: `${pct(rate, 0)} responderam as perguntas da página de obrigado. Em ${bestQ.source} a taxa sobe para ${pct(ratio(bestQ.answered, bestQ.leads), 0)}.`,
      });
    } else {
      out.push({
        kicker: "Qualidade",
        text: `${k.answered} de ${total} cadastros (${pct(rate, 0)}) responderam a qualificação. ${k.founders ? `${k.founders} viraram Fundador.` : "Nenhum Fundador neste recorte."}`,
      });
    }
  }

  const a = d.attribution;
  if (a.changed > 0) {
    const topAssist = d.journeys.find((j) => j.assisted);
    out.push({
      kicker: "Jornada",
      text: `${a.changed} pessoa${a.changed === 1 ? "" : "s"} mudou de origem entre a primeira visita e o cadastro. O último toque sozinho esconde o papel de ${topAssist ? topAssist.first : "fontes anteriores"}${topAssist ? ` → ${topAssist.last}` : ""}.`,
    });
  } else if (a.same > 0 && total >= 2) {
    out.push({
      kicker: "Jornada",
      text: "Ninguém mudou de fonte entre a primeira visita e o cadastro. Primeiro e último toque contam a mesma história neste período.",
    });
  }

  if (!k.campaigns) {
    out.push({
      kicker: "Campanha",
      text: "Nenhuma campanha nomeada no período. O gerador de links já preenche utm_campaign=bora_vamos_em_frente — vale usar nas peças para separar criativo de canal.",
    });
  } else if (d.by_campaign[0]) {
    const c = d.by_campaign[0];
    out.push({
      kicker: "Campanha",
      text: `${c.campaign} é a campanha que mais cadastra (${c.leads}), via ${c.source} · ${c.medium}. ${k.campaigns} campanha${k.campaigns === 1 ? "" : "s"} no recorte.`,
    });
  }

  const prev = k.leads_prev;
  if (prev > 0 && k.leads !== prev) {
    const up = k.leads > prev;
    out.push({
      kicker: "Ritmo",
      text: `Cadastros ${up ? "subiram" : "caíram"} ${pct(Math.abs(((k.leads - prev) / prev) * 100), 0)} contra o período anterior de mesmo tamanho (${prev} → ${k.leads}).`,
    });
  }

  const geo = d.by_uf[0];
  if (geo && d.by_uf.length >= 2) {
    out.push({
      kicker: "Praça",
      text: `${geo.uf} lidera com ${geo.leads} cadastro${geo.leads === 1 ? "" : "s"}, puxado por ${geo.top_source}. ${d.by_uf.length} UFs no recorte.`,
    });
  }

  return out.slice(0, 4);
}
