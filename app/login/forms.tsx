"use client";
import { useActionState, useEffect, useState } from "react";
import { signIn, verifyCode, confirmEnroll, newPassword, startEnroll, type FormState } from "./actions";
import { Button, Field, inputCls } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordGuide } from "./PasswordGuide";

function Err({ s }: { s: FormState }) {
  return s.error ? <p className="mb-3 rounded-sm border border-danger/40 bg-danger-soft px-3 py-2 text-[12.5px] text-danger" role="alert">{s.error}</p> : null;
}

export function PasswordForm() {
  const [s, act, busy] = useActionState(signIn, {});
  return (
    <form action={act} className="space-y-3">
      <Err s={s} />
      <Field label="E-mail">
        <input name="email" type="email" autoComplete="username" required className={inputCls} autoFocus />
      </Field>
      <Field label="Senha">
        <PasswordInput name="password" autoComplete="current-password" required />
      </Field>
      <Button variant="primary" className="mt-2 w-full" disabled={busy}>{busy ? "Entrando…" : "Continuar"}</Button>
    </form>
  );
}

export function CodeInput({ autoFocus = true }: { autoFocus?: boolean }) {
  return (
    <input
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]{6,7}"
      maxLength={7}
      required
      autoFocus={autoFocus}
      placeholder="000 000"
      className={`${inputCls} mono h-12 text-center text-[22px] tracking-[0.4em]`}
    />
  );
}

export function CodeForm({ next }: { next?: string }) {
  const [s, act, busy] = useActionState(verifyCode, {});
  return (
    <form action={act} className="space-y-3">
      <Err s={s} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Código do autenticador">
        <CodeInput />
      </Field>
      <Button variant="primary" className="mt-2 w-full" disabled={busy}>{busy ? "Conferindo…" : "Entrar"}</Button>
    </form>
  );
}

export function EnrollForm() {
  const [data, setData] = useState<{ factorId?: string; qr?: string; secret?: string; error?: string } | null>(null);
  const [s, act, busy] = useActionState(confirmEnroll, {});
  useEffect(() => {
    startEnroll().then(setData);
  }, []);
  if (!data) return <p className="text-fg-3">Gerando o código…</p>;
  if (data.error) return <p className="text-danger">{data.error}</p>;
  return (
    <form action={act} className="space-y-4">
      <Err s={s} />
      <ol className="space-y-1 text-fg-2">
        <li>1. Abra o Google Authenticator e toque em +.</li>
        <li>2. Leia o QR code abaixo.</li>
        <li>3. Digite os 6 dígitos que aparecerem.</li>
      </ol>
      <div className="flex justify-center rounded-sm border border-line bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.qr} alt="QR code para o autenticador" width={176} height={176} />
      </div>
      <details className="text-fg-3">
        <summary className="cursor-pointer select-none">Não consegue ler? Digite a chave</summary>
        <code className="mono mt-2 block break-all rounded-sm bg-surface-2 p-2 text-[12px] text-fg">{data.secret}</code>
      </details>
      <input type="hidden" name="factorId" value={data.factorId} />
      <Field label="Código de 6 dígitos">
        <CodeInput autoFocus={false} />
      </Field>
      <Button variant="primary" className="w-full" disabled={busy}>{busy ? "Conferindo…" : "Ativar e entrar"}</Button>
    </form>
  );
}

export function NewPasswordForm() {
  const [s, act, busy] = useActionState(newPassword, {});
  const [pw, setPw] = useState("");
  useEffect(() => setPw(""), [s]);
  return (
    <form action={act} className="space-y-3">
      <Err s={s} />
      <PasswordGuide value={pw} className="mb-4" />
      <Field label="Nova senha">
        <PasswordInput name="password" autoComplete="new-password" required minLength={12} autoFocus onValue={setPw} />
      </Field>
      <Field label="Repita a senha">
        <PasswordInput name="again" autoComplete="new-password" required minLength={12} />
      </Field>
      <Button variant="primary" className="mt-2 w-full" disabled={busy}>{busy ? "Salvando…" : "Salvar e entrar"}</Button>
    </form>
  );
}
