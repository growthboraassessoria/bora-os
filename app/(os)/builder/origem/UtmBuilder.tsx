"use client";
// Gerador de links com UTM no padrão da campanha: minúsculas, sem acento, palavras com sublinhado.
import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { Panel, Field, inputCls, Button } from "@/components/ui";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function UtmBuilder({ base = "https://lp-bora-campanha-nacional.vercel.app/" }: { base?: string }) {
  const [v, setV] = useState({ url: base, source: "instagram", medium: "social", campaign: "bora_vamos_em_frente", content: "" });
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => {
    try {
      const u = new URL(v.url);
      for (const k of ["source", "medium", "campaign", "content"] as const) {
        const val = norm(v[k]);
        if (val) u.searchParams.set(`utm_${k}`, val); else u.searchParams.delete(`utm_${k}`);
      }
      return u.toString();
    } catch {
      return "";
    }
  }, [v]);
  const field = (k: keyof typeof v, label: string, hint?: string) => (
    <Field label={label} hint={hint}><input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={inputCls} /></Field>
  );
  return (
    <Panel eyebrow="Gerador de links" title="Link com UTM no padrão da campanha">
      <div className="grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2">{field("url", "Página")}</div>
        {field("source", "Fonte", "instagram, meta, google…")}
        {field("medium", "Meio", "social, paid, cpc, referral…")}
        {field("campaign", "Campanha")}
        <div className="md:col-span-2">{field("content", "Conteúdo", "Opcional: peça ou criativo")}</div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <code className="mono min-w-0 flex-1 truncate rounded-sm border border-line bg-bg px-3 py-2 text-[12px] text-fg-2">{link || "URL inválida"}</code>
        <Button disabled={!link} onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy size={13} />{copied ? "Copiado" : "Copiar"}</Button>
      </div>
    </Panel>
  );
}
