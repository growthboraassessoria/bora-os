"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, inputCls } from "@/components/ui";
import { num } from "@/lib/format";
import { saveWhatsapp } from "./actions";

type State = { uf: string; name: string; whatsapp_url: string | null; leads: number };

export function WhatsappLinks({ states, canEdit }: { states: State[]; canEdit: boolean }) {
  return <ul className="divide-y divide-line">{states.map((s) => <Row key={s.uf} s={s} canEdit={canEdit} />)}</ul>;
}

function Row({ s, canEdit }: { s: State; canEdit: boolean }) {
  const [v, setV] = useState(s.whatsapp_url ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  const changed = v !== (s.whatsapp_url ?? "");
  return (
    <li className="py-2">
      <div className="mb-1 flex justify-between"><span>{s.name} <span className="mono text-fg-3">{s.uf}</span></span><span className="num text-fg-3">{num(s.leads)} pessoas</span></div>
      {canEdit ? (
        <div className="flex gap-2">
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder="https://chat.whatsapp.com/…" className={`${inputCls} mono text-[12px]`} />
          <Button disabled={busy || !changed} onClick={() => start(async () => { const r = await saveWhatsapp(s.uf, v); if (!r.ok) setErr(r.error); else { setErr(null); router.refresh(); } })}>Salvar</Button>
        </div>
      ) : <p className="mono truncate text-[12px] text-fg-2">{s.whatsapp_url ?? "sem grupo"}</p>}
      {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
    </li>
  );
}
