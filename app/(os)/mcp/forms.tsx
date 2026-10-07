"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound } from "lucide-react";
import { Button, Field, Panel, inputCls, Chip } from "@/components/ui";
import { useStepUp } from "@/components/useStepUp";
import { createConnection, revokeConnection, toggleTool } from "./actions";

type P = { key: string; label: string; sensitive: boolean };
type T = { name: string; description: string; required_perm: string; write: boolean };

export function NewConnection({ perms, tools }: { perms: P[]; tools: T[] }) {
  const [name, setName] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set(["builder.dashboard.read", "builder.leads.read"].filter((k) => perms.some((p) => p.key === k))));
  const [days, setDays] = useState(30);
  const [ips, setIps] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const stepUp = useStepUp();
  const router = useRouter();
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const reach = tools.filter((t) => sel.has(t.required_perm));

  if (token) return (
    <Panel eyebrow="Chave criada" title="Copie agora: ela não aparece de novo">
      <code className="mono block break-all rounded-sm border border-line-strong bg-bg p-2 text-[12px] text-fg">{token}</code>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={() => navigator.clipboard.writeText(token)}><Copy size={13} />Copiar</Button>
        <Button variant="ghost" onClick={() => { setToken(null); setName(""); router.refresh(); }}>Concluir</Button>
      </div>
    </Panel>
  );

  return (
    <Panel eyebrow="Nova chave" title="Conectar um sistema">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createConnection({ name, permissions: [...sel], tools: null, days, ips });
          if (stepUp(r)) return;
          if (!r.ok) return setErr(r.error);
          setErr(null); setToken(r.data!.token);
        });
      }}>
        {err && <p className="rounded-sm border border-danger/40 bg-danger-soft px-3 py-2 text-danger">{err}</p>}
        <Field label="Nome" hint="Quem vai usar. Ex.: Claude Code do Alex, n8n produção."><input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} className={inputCls} /></Field>
        <fieldset>
          <legend className="eyebrow mb-1.5">Permissões</legend>
          <div className="space-y-1">
            {perms.map((p) => (
              <label key={p.key} className="flex items-center gap-2">
                <input type="checkbox" checked={sel.has(p.key)} onChange={() => toggle(p.key)} />
                <span>{p.label}</span>{p.sensitive && <Chip tone="warning">sensível</Chip>}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-fg-3">Só aparecem permissões que você tem. Admin e MCP nunca vão para uma chave.</p>
        </fieldset>
        <div className="text-fg-2"><p className="mb-1">Ferramentas liberadas:</p><p className="flex flex-wrap gap-1">{reach.length ? reach.map((t) => <span key={t.name} className="mono rounded-xs bg-surface-3 px-1.5 text-[11px] text-fg">{t.name}</span>) : <span className="text-fg-3">nenhuma</span>}</p></div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Validade (dias)" hint="Até 90."><input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${inputCls} mono`} /></Field>
          <Field label="IPs permitidos" hint="Opcional. Vazio = qualquer."><input value={ips} onChange={(e) => setIps(e.target.value)} placeholder="200.1.2.3/32" className={`${inputCls} mono text-[12px]`} /></Field>
        </div>
        <Button variant="primary" disabled={busy || !sel.size || name.trim().length < 2}><KeyRound size={13} />{busy ? "Criando…" : "Criar chave"}</Button>
        <p className="text-[11.5px] text-fg-3">Pede o código do autenticador se o último tiver mais de 10 minutos.</p>
      </form>
    </Panel>
  );
}

export function RevokeButton({ id, name }: { id: string; name: string }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  return <Button variant="danger" className="h-7" disabled={busy} onClick={() => confirm(`Revogar a chave "${name}"? O sistema conectado perde o acesso na hora.`) && start(async () => { await revokeConnection(id); router.refresh(); })}>Revogar</Button>;
}

export function ToolToggle({ name, enabled, canEdit }: { name: string; enabled: boolean; canEdit: boolean }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" disabled={!canEdit || busy} checked={enabled} onChange={(e) => start(async () => { await toggleTool(name, e.target.checked); router.refresh(); })} />
      <span className={enabled ? "text-fg" : "text-fg-3"}>{enabled ? "ligada" : "desligada"}</span>
    </label>
  );
}
