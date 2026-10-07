"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Field, Panel, inputCls, Empty, cx } from "@/components/ui";
import { date } from "@/lib/format";
import { saveSettings, saveSite, approveTestimonial } from "./actions";

export type Settings = {
  city_goal?: number; founder_slots?: number; checkout_url?: string; short_domain?: string; ga_id?: string; pixel_id?: string;
  experiment_hero?: { enabled?: boolean; winner?: "A" | "B" | null };
};
type Site = { id: string; name: string; domain: string | null; production_url: string; revalidate_url: string | null; status: string };

export function SettingsForm({ settings, site, canEdit, canPublish }: { settings: Settings; site: Site; canEdit: boolean; canPublish: boolean }) {
  const [s, setS] = useState<Settings>(settings);
  const [st, setSt] = useState<Site>(site);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  const exp = s.experiment_hero ?? { enabled: true, winner: null };
  const txt = (k: keyof Settings, label: string, hint?: string, mono?: boolean) => (
    <Field label={label} hint={hint}><input disabled={!canEdit} value={String(s[k] ?? "")} onChange={(e) => setS({ ...s, [k]: e.target.value })} className={cx(inputCls, mono && "mono text-[12px]")} /></Field>
  );
  return (
    <div className="space-y-4">
      <Panel eyebrow="Campanha" title="Metas, checkout e analytics">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveSettings(s, canPublish); setMsg(r.ok ? { ok: true, text: r.data?.note ?? "Salvo." } : { ok: false, text: r.error }); router.refresh(); }); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Meta por cidade" hint="Pessoas para 100% no ranking. Hoje: 500."><input type="number" min={10} max={100000} disabled={!canEdit} value={s.city_goal ?? 500} onChange={(e) => setS({ ...s, city_goal: Number(e.target.value) })} className={`${inputCls} mono`} /></Field>
            <Field label="Vagas de Fundador por cidade" hint="Founding 50."><input type="number" min={1} max={1000} disabled={!canEdit} value={s.founder_slots ?? 50} onChange={(e) => setS({ ...s, founder_slots: Number(e.target.value) })} className={`${inputCls} mono`} /></Field>
          </div>
          {txt("checkout_url", "Checkout do Fundador", "URL https. Vazio = botão mostra “em breve”.", true)}
          {txt("short_domain", "Domínio curto do link de indicação", "Ex.: bora.com.br (sem https). Só quando o domínio apontar para a LP.", true)}
          <div className="grid gap-3 sm:grid-cols-2">
            {txt("ga_id", "GA4 (ID de medição)", "G-XXXXXXX", true)}
            {txt("pixel_id", "Meta Pixel (ID)", undefined, true)}
          </div>
          <fieldset className="rounded-sm border border-line p-3">
            <legend className="eyebrow px-1">Teste A/B da manchete</legend>
            <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={exp.enabled !== false} onChange={(e) => setS({ ...s, experiment_hero: { ...exp, enabled: e.target.checked } })} />Sortear variante A ou B na primeira visita</label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-fg-2">Vencedora fixa:</span>
              {([null, "A", "B"] as const).map((w) => (
                <button type="button" key={String(w)} disabled={!canEdit} onClick={() => setS({ ...s, experiment_hero: { ...exp, winner: w } })}
                  className={cx("mono h-7 rounded-sm border px-2 text-[11px]", (exp.winner ?? null) === w ? "border-active text-fg" : "border-line-strong text-fg-3")}>{w ?? "nenhuma"}</button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-fg-3">Com vencedora fixa, todo mundo vê a mesma manchete e o sorteio para.</p>
          </fieldset>
          {msg && <p className={msg.ok ? "text-fg-2" : "text-danger"}>{msg.text}</p>}
          {canEdit && <Button variant="primary" disabled={busy}>{busy ? "Salvando…" : canPublish ? "Salvar e avisar a LP" : "Salvar"}</Button>}
        </form>
      </Panel>
      <Panel eyebrow="Conexão" title="Endereços do site">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveSite(st); setMsg(r.ok ? { ok: true, text: "Endereços salvos." } : { ok: false, text: r.error }); router.refresh(); }); }}>
          <Field label="Nome"><input disabled={!canEdit} value={st.name} onChange={(e) => setSt({ ...st, name: e.target.value })} className={inputCls} /></Field>
          <Field label="URL de produção"><input disabled={!canEdit} value={st.production_url} onChange={(e) => setSt({ ...st, production_url: e.target.value })} className={`${inputCls} mono text-[12px]`} /></Field>
          <Field label="URL de revalidação" hint="Rota da LP que recebe o aviso assinado de publicação."><input disabled={!canEdit} value={st.revalidate_url ?? ""} onChange={(e) => setSt({ ...st, revalidate_url: e.target.value })} className={`${inputCls} mono text-[12px]`} /></Field>
          {canEdit && <Button disabled={busy}>Salvar endereços</Button>}
        </form>
      </Panel>
    </div>
  );
}

type T = { id: string; name: string; city: string; text: string; approved: boolean; created_at: string };

export function Testimonials({ items, canEdit }: { items: T[]; canEdit: boolean }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <Panel eyebrow="Prova social" title="Depoimentos" pad={false}>
      <p className="px-4 pt-3 text-fg-3">A LP só mostra depoimentos aprovados. Use depoimentos reais, com autorização.</p>
      <ul className="mt-2">
        {items.map((t) => (
          <li key={t.id} className="border-t border-line px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="font-medium">{t.name} <span className="text-fg-3">· {t.city} · {date(t.created_at)}</span></p><p className="mt-1 text-fg-2">“{t.text}”</p></div>
              {t.approved ? <Chip tone="signal">aprovado</Chip> : <Chip tone="outline">pendente</Chip>}
            </div>
            {canEdit && <Button className="mt-2" variant={t.approved ? "ghost" : "secondary"} disabled={busy} onClick={() => start(async () => { await approveTestimonial(t.id, !t.approved); router.refresh(); })}>{t.approved ? "Tirar do ar" : "Aprovar"}</Button>}
          </li>
        ))}
      </ul>
      {!items.length && <Empty title="Nenhum depoimento recebido." />}
    </Panel>
  );
}
