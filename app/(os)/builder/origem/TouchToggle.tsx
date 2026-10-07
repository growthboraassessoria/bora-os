"use client";
import { useSetParam } from "@/components/builder/Filters";
import { cx } from "@/components/ui";

export function TouchToggle({ value }: { value: string }) {
  const set = useSetParam();
  return (
    <div className="flex h-8 overflow-hidden rounded-sm border border-line-strong" role="group" aria-label="Toque">
      {[["last", "Último toque"], ["first", "Primeiro toque"]].map(([id, label]) => (
        <button key={id} onClick={() => set({ toque: id === "first" ? "primeiro" : null })}
          className={cx("mono px-2.5 text-[11px] uppercase tracking-[0.06em] text-fg-3 hover:text-fg", value === id && "bg-surface-3 text-fg")}>{label}</button>
      ))}
    </div>
  );
}
