"use client";
import { useState } from "react";
import { useSetParam } from "@/components/builder/Filters";
import { inputCls } from "@/components/ui";

export function CodeSearch({ value }: { value?: string }) {
  const [v, setV] = useState(value ?? "");
  const set = useSetParam();
  return (
    <form onSubmit={(e) => { e.preventDefault(); set({ codigo: v.trim().toUpperCase() || null }); }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Código" className={`${inputCls} mono w-32 uppercase`} aria-label="Código de indicação" />
    </form>
  );
}
