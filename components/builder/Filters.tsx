"use client";
// Seletor de período e de UF que vive na URL (dá para compartilhar o link da visão).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIODS } from "@/lib/format";
import { cx } from "../ui";

export const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export function useSetParam() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v == null || v === "" ? next.delete(k) : next.set(k, v));
    router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
}

export function PeriodPicker({ value }: { value: string }) {
  const set = useSetParam();
  return (
    <div className="flex h-10 overflow-hidden rounded-[10px] border border-line-strong max-md:w-full md:h-8 md:rounded-sm" role="group" aria-label="Período">
      {PERIODS.map((p) => (
        <button key={p.id} onClick={() => set({ p: p.id })}
          className={cx("mono px-2.5 text-[11px] uppercase tracking-[0.06em] text-fg-3 hover:text-fg max-md:flex-1", value === p.id && "bg-surface-3 text-fg")}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function UfPicker({ value, allowed }: { value?: string; allowed?: string[] | null }) {
  const set = useSetParam();
  const list = allowed?.length ? allowed : UFS;
  return (
    <select value={value ?? ""} onChange={(e) => set({ uf: e.target.value || null })} aria-label="UF"
      className="h-10 md:h-8 rounded-[10px] md:rounded-sm border border-line-strong bg-surface px-2 text-[12px] text-fg">
      <option value="">{allowed?.length ? "Meu escopo" : "Todas as UFs"}</option>
      {list.map((u) => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}
