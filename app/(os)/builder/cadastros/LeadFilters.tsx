"use client";
import { useEffect, useState, useTransition } from "react";
import { Download, Plus, Search } from "lucide-react";
import { useSetParam, UFS } from "@/components/builder/Filters";
import { Button, LinkButton, inputCls, cx } from "@/components/ui";
import { useStepUp } from "@/components/useStepUp";
import { exportLeads } from "./actions";
import { filtersFrom } from "@/lib/leadFilters";

type Props = { sp: Record<string, string | undefined>; allowed: string[] | null; canPii: boolean; canCreate: boolean; canExport: boolean; total: number };

const TRI = [
  { key: "indicado", label: "Indicado" },
  { key: "respondeu", label: "Respondeu" },
  { key: "fundador", label: "Fundador" },
  { key: "marketing", label: "Aceita marketing" },
];

export function LeadFilters({ sp, allowed, canPii, canCreate, canExport, total }: Props) {
  const set = useSetParam();
  const [q, setQ] = useState(sp.q ?? "");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const stepUp = useStepUp();

  useEffect(() => {
    const t = setTimeout(() => { if ((sp.q ?? "") !== q) set({ q: q || null, page: null, id: null }); }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const doExport = () => start(async () => {
    setMsg(null);
    const r = await exportLeads(filtersFrom(sp));
    if (stepUp(r)) return;
    if (!r.ok) return setMsg(r.error);
    const blob = new Blob([r.data!.csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bora-cadastros-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg(`${r.data!.rows} linhas exportadas${r.data!.pii ? " com contato" : ", contato mascarado"}. Registrado na auditoria.`);
  });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputCls, "pl-8")}
            placeholder={canPii ? "Nome, BORA ID, código, cidade, e-mail, telefone ou CPF" : "Nome, BORA ID, código ou cidade"} />
        </div>
        <select value={sp.uf ?? ""} onChange={(e) => set({ uf: e.target.value || null, page: null })} className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-[12px]" aria-label="UF">
          <option value="">{allowed?.length ? "Meu escopo" : "Todas as UFs"}</option>
          {(allowed?.length ? allowed : UFS).map((u) => <option key={u}>{u}</option>)}
        </select>
        <select value={sp.origem ?? ""} onChange={(e) => set({ origem: e.target.value || null, page: null })} className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-[12px]" aria-label="Fonte">
          <option value="">Toda fonte</option>
          {["instagram", "meta", "whatsapp", "google", "tiktok", "(direto)"].map((s) => <option key={s}>{s}</option>)}
        </select>
        {TRI.map((t) => (
          <select key={t.key} value={sp[t.key] ?? ""} onChange={(e) => set({ [t.key]: e.target.value || null, page: null })}
            className={cx("h-8 rounded-sm border bg-surface px-2 text-[12px]", sp[t.key] ? "border-active text-fg" : "border-line-strong text-fg-2")} aria-label={t.label}>
            <option value="">{t.label}: todos</option>
            <option value="true">{t.label}: sim</option>
            <option value="false">{t.label}: não</option>
          </select>
        ))}
        <div className="ml-auto flex gap-2">
          {canExport && <Button onClick={doExport} disabled={busy || total === 0}><Download size={14} />{busy ? "Exportando…" : "Exportar"}</Button>}
          {canCreate && <LinkButton href="/builder/cadastros/novo" variant="primary"><Plus size={14} />Novo cadastro</LinkButton>}
        </div>
      </div>
      {msg && <p className="text-fg-2">{msg}</p>}
    </div>
  );
}
