"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Panel } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordGuide } from "@/app/login/PasswordGuide";
import { useStepUp } from "@/components/useStepUp";
import { changePassword } from "./actions";
import { endSessions } from "../admin/actions";

export function ChangePassword() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const [pw, setPw] = useState("");
  const stepUp = useStepUp();
  return (
    <Panel eyebrow="Senha" title="Trocar senha">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        start(async () => {
          const r = await changePassword(String(f.get("password")), String(f.get("again")));
          if (stepUp(r)) return;
          setMsg(r.ok ? { ok: true, text: "Senha trocada." } : { ok: false, text: r.error });
          if (r.ok) { form.reset(); setPw(""); }
        });
      }}>
        {msg && <p className={msg.ok ? "text-fg-2" : "text-danger"}>{msg.text}</p>}
        <PasswordGuide value={pw} className="mx-0 mb-4" />
        <Field label="Nova senha"><PasswordInput name="password" autoComplete="new-password" minLength={12} required onValue={setPw} /></Field>
        <Field label="Repita"><PasswordInput name="again" autoComplete="new-password" minLength={12} required /></Field>
        <Button variant="primary" disabled={busy}>Trocar senha</Button>
      </form>
    </Panel>
  );
}

export function EndOtherSessions({ userId }: { userId: string }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  return <Button disabled={busy} onClick={() => start(async () => { await endSessions(userId); router.refresh(); })}>Encerrar as outras</Button>;
}
