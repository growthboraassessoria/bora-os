"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, inputCls, Panel } from "@/components/ui";
import { createLead, lookupCep } from "../actions";
import { boraId } from "@/lib/format";

export function NewLeadForm() {
  const [geo, setGeo] = useState<{ city: string; uf: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();

  const onCep = (v: string) => {
    const d = v.replace(/\D/g, "");
    setGeo(null);
    if (d.length !== 8) return;
    start(async () => {
      const r = await lookupCep(d);
      if (r.ok) { setGeo({ city: r.data!.city, uf: r.data!.uf }); setErr(null); } else setErr(r.error);
    });
  };

  return (
    <Panel>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        start(async () => {
          const r = await createLead({ ...f, privacy_consent: f.privacy_consent === "on", marketing_consent: f.marketing_consent === "on" });
          if (!r.ok) return setErr(r.error);
          if (!r.data!.created) {
            if (confirm(`Essa pessoa já está na base (${boraId(r.data!.bora_number)}). Abrir a ficha?`)) router.push(`/builder/cadastros?id=${r.data!.id}`);
            return;
          }
          router.push(`/builder/cadastros?id=${r.data!.id}`);
        });
      }}>
        {err && <p className="rounded-sm border border-danger/40 bg-danger-soft px-3 py-2 text-danger">{err}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome"><input name="first_name" required className={inputCls} autoFocus /></Field>
          <Field label="Sobrenome"><input name="last_name" required className={inputCls} /></Field>
          <Field label="WhatsApp" hint="Com DDD."><input name="phone" required inputMode="tel" className={`${inputCls} mono`} /></Field>
          <Field label="E-mail"><input name="email" type="email" required className={inputCls} /></Field>
          <Field label="CEP" hint={geo ? `${geo.city} · ${geo.uf}` : "Cidade e UF saem do CEP."}>
            <input name="cep" required inputMode="numeric" maxLength={9} onChange={(e) => onCep(e.target.value)} className={`${inputCls} mono`} />
          </Field>
          <Field label="CPF" hint="Opcional."><input name="cpf" inputMode="numeric" className={`${inputCls} mono`} /></Field>
          <Field label="Nascimento" hint="Opcional."><input name="birth_date" type="date" className={inputCls} /></Field>
          <Field label="Sexo" hint="Opcional.">
            <select name="sex" className={inputCls} defaultValue=""><option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="N">Prefere não dizer</option></select>
          </Field>
          <Field label="Código de quem indicou" hint="Opcional. Ex.: ALEX982"><input name="referred_by" className={`${inputCls} mono uppercase`} /></Field>
          <Field label="Origem (utm_source)" hint="Opcional. Ex.: evento, balcao, instagram"><input name="utm_source" className={inputCls} /></Field>
        </div>
        <div className="space-y-1.5 pt-1">
          <label className="flex items-center gap-2"><input type="checkbox" name="privacy_consent" required />A pessoa aceitou o aviso de privacidade.</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="marketing_consent" />Aceita receber contato de marketing.</label>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="primary" disabled={busy || !geo}>{busy ? "Salvando…" : "Cadastrar"}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
        </div>
      </form>
    </Panel>
  );
}
