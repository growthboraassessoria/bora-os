"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { Button, Field, Panel, inputCls, cx } from "@/components/ui";
import { useStepUp } from "@/components/useStepUp";
import { setRolePermission, createRole, deleteRole } from "../actions";

export function PermToggle({ roleId, perm, on, locked }: { roleId: string; perm: string; on: boolean; locked: boolean }) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState(false);
  const stepUp = useStepUp();
  const router = useRouter();
  if (locked) return <span className="inline-grid h-5 w-5 place-items-center text-fg-3" title="Proprietário tem todas"><Lock size={12} /></span>;
  return (
    <button aria-pressed={on} disabled={busy} title={err ? "Não foi possível alterar" : on ? "Retirar" : "Conceder"}
      onClick={() => start(async () => { const r = await setRolePermission(roleId, perm, !on); if (stepUp(r)) return; setErr(!r.ok); router.refresh(); })}
      className={cx("inline-grid h-5 w-5 place-items-center rounded-xs border transition-colors", on ? "border-active bg-active text-bg" : "border-line-strong hover:border-fg-3", err && "border-danger", busy && "opacity-40")}>
      {on && <Check size={12} strokeWidth={3} />}
    </button>
  );
}

export function NewRole({ roles }: { roles: { id: string; name: string }[] }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <Panel eyebrow="Novo papel" title="Criar papel">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        start(async () => {
          const r = await createRole({ name: f.get("name"), description: f.get("description") ?? "" }, String(f.get("copy") || "") || undefined);
          if (!r.ok) return setErr(r.error);
          setErr(null); form.reset(); router.refresh();
        });
      }}>
        {err && <p className="text-danger">{err}</p>}
        <Field label="Nome"><input name="name" required minLength={2} maxLength={40} className={inputCls} placeholder="Ex.: Captain Goiás" /></Field>
        <Field label="Descrição"><input name="description" maxLength={200} className={inputCls} /></Field>
        <Field label="Começar com as permissões de">
          <select name="copy" className={inputCls}><option value="">nenhum (vazio)</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </Field>
        <Button variant="primary" disabled={busy}>Criar papel</Button>
      </form>
    </Panel>
  );
}

export function DeleteRole({ id, name }: { id: string; name: string }) {
  const [busy, start] = useTransition();
  const stepUp = useStepUp();
  const router = useRouter();
  return <Button variant="ghost" className="h-7 text-danger" disabled={busy} onClick={() => confirm(`Apagar o papel "${name}"?`) && start(async () => { const r = await deleteRole(id); if (stepUp(r)) return; if (!r.ok) alert(r.error); router.refresh(); })}>Apagar</Button>;
}
