"use client";
// Ficha do cadastro no painel da direita: dados, contato (revelar), origem, indicação, respostas, notas, etiquetas, eventos e histórico.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, X, Trash2 } from "lucide-react";
import type { LeadDetail } from "@/lib/builder";
import { QUESTION_LABEL, EVENT_LABEL } from "@/lib/eventLabels";
import { boraId, date, dateTime, phone, cpf, cep } from "@/lib/format";
import { Button, Chip, KV, Field, inputCls, cx } from "@/components/ui";
import { useStepUp } from "@/components/useStepUp";
import { Avatar } from "@/components/Avatar";
import { revealLead, updateLead, addNote, setTags, anonymizeLead } from "./actions";

type Perms = { edit: boolean; anonymize: boolean; pii: boolean };
const TABS = ["Ficha", "Indicação", "Respostas", "Eventos", "Histórico"] as const;

export function Inspector({ lead, perms, closeHref }: { lead: LeadDetail; perms: Perms; closeHref: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Ficha");
  const [pii, setPii] = useState<Pick<LeadDetail, "email" | "phone" | "phone2" | "cpf" | "birth_date"> | null>(null);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();
  const stepUp = useStepUp();
  const L = { ...lead, ...(pii ?? {}) };
  const anon = !!lead.anonymized_at;

  const reveal = () => start(async () => {
    const r = await revealLead(lead.id);
    if (!r.ok) return setErr(r.error);
    setPii(r.data!);
  });

  return (
    <aside className="flex h-full w-full flex-col border-l border-line bg-surface xl:w-[400px]" aria-label="Ficha do cadastro">
      <header className="border-b border-line px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {lead.photo_url ? (
              <a href={lead.photo_url} target="_blank" rel="noreferrer" title="Abrir a foto em tamanho real"><Avatar url={lead.photo_url} name={`${lead.first_name} ${lead.last_name}`} size={64} /></a>
            ) : <Avatar name={`${lead.first_name} ${lead.last_name}`} size={64} />}
          <div className="min-w-0">
            <p className="eyebrow">Cadastro · {boraId(lead.bora_number)}</p>
            <h2 className="mt-0.5 truncate text-[16px] font-semibold">{lead.first_name} {lead.last_name}</h2>
            <p className="text-fg-3">{lead.city} · {lead.state} · desde {date(lead.created_at)}</p>
          </div>
          </div>
          <Link href={closeHref} scroll={false} className="text-fg-3 hover:text-fg" aria-label="Fechar"><X size={16} /></Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {anon && <Chip tone="danger">anonimizado</Chip>}
          {lead.founder && <Chip tone="signal">Fundador #{lead.founder.founder_number}</Chip>}
          {lead.referred_by && <Chip>indicado</Chip>}
          {lead.network.signups > 0 && <Chip>{lead.network.signups} indicações</Chip>}
          <Chip tone="outline">{lead.source}</Chip>
          {(lead.tags ?? []).map((t) => <Chip key={t} tone="outline">{t}</Chip>)}
        </div>
        <nav className="-mb-3 mt-3 flex gap-4 border-b-0">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cx("relative pb-2.5 text-[12px] text-fg-3 hover:text-fg", tab === t && "text-fg")}>
              {t}{tab === t && <span className="absolute inset-x-0 -bottom-px h-[2px] bg-active" />}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {err && <p className="mb-3 rounded-sm border border-danger/40 bg-danger-soft px-3 py-2 text-danger">{err}</p>}

        {tab === "Ficha" && !editing && (
          <div className="space-y-4">
            <section>
              <div className="mb-1 flex items-center justify-between">
                <p className="eyebrow">Contato</p>
                {lead.can_reveal && !pii && !anon && <button onClick={reveal} disabled={busy} className="eyebrow flex items-center gap-1 hover:text-fg"><Eye size={12} />revelar</button>}
              </div>
              <KV k="E-mail" v={L.email} mono />
              <KV k="WhatsApp" v={phone(L.phone)} mono />
              {L.phone2 && <KV k="2º telefone" v={phone(L.phone2)} mono />}
              <KV k="CPF" v={cpf(L.cpf)} mono />
              <KV k="Nascimento" v={L.birth_date?.includes("•") ? L.birth_date : date(L.birth_date)} mono />
              {pii && <p className="mt-1 text-[11.5px] text-fg-3">Revelação registrada na auditoria.</p>}
            </section>
            <section>
              <p className="eyebrow mb-1">Cadastro</p>
              <KV k="BORA ID" v={boraId(lead.bora_number)} mono />
              <KV k="Código" v={lead.referral_code} mono />
              <KV k="CEP" v={cep(lead.cep)} mono />
              <KV k="Sexo" v={{ F: "Feminino", M: "Masculino", N: "Prefere não dizer" }[lead.sex ?? ""] ?? "—"} />
              <KV k="Marketing" v={lead.marketing_consent ? "aceita" : "não aceita"} />
              <KV k="Privacidade" v={lead.privacy_consent ? "aceito" : "—"} />
            </section>
            {(lead.instagram || lead.bio || lead.public_profile || lead.last_login_at) && (
              <section>
                <p className="eyebrow mb-1">Área do membro</p>
                {lead.instagram && <KV k="Instagram" v={<a className="hover:underline" href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer">@{lead.instagram}</a>} />}
                {lead.bio && <p className="py-1.5 text-fg-2">“{lead.bio}”</p>}
                <KV k="Perfil público" v={lead.public_profile ? (lead.public_whatsapp ? "sim, com WhatsApp" : "sim") : "não"} />
                <KV k="Último acesso" v={lead.last_login_at ? dateTime(lead.last_login_at) : "nunca entrou"} />
              </section>
            )}
            <section>
              <p className="eyebrow mb-1">Origem</p>
              <KV k="Fonte · meio" v={`${lead.utm.source ?? "(direto)"} · ${lead.utm.medium ?? "—"}`} />
              <KV k="Campanha" v={lead.utm.campaign ?? "—"} />
              <KV k="Primeiro toque" v={lead.first_touch?.utm_source ?? "—"} />
              <KV k="Variante A/B" v={lead.experiment?.hero ?? "—"} mono />
            </section>
            {perms.edit && !anon && <TagsBox lead={lead} />}
            {perms.edit && !anon && <NotesBox lead={lead} />}
            {!perms.edit && lead.notes.length > 0 && <NotesList notes={lead.notes} />}
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              {perms.edit && !anon && <Button onClick={() => setEditing(true)}><Pencil size={13} />Editar</Button>}
              {perms.anonymize && !anon && (
                <Button variant="danger" disabled={busy} onClick={() => {
                  if (!confirm(`Anonimizar ${boraId(lead.bora_number)}? Nome, contato, CPF e nascimento serão apagados. Não tem volta.`)) return;
                  start(async () => {
                    const r = await anonymizeLead(lead.id);
                    if (stepUp(r)) return;
                    if (!r.ok) return setErr(r.error);
                    router.refresh();
                  });
                }}><Trash2 size={13} />Anonimizar (LGPD)</Button>
              )}
            </div>
          </div>
        )}

        {tab === "Ficha" && editing && <EditForm lead={L} canPii={perms.pii && (!!pii || !lead.pii_masked)} onDone={() => { setEditing(false); setPii(null); router.refresh(); }} onCancel={() => setEditing(false)} />}

        {tab === "Indicação" && (
          <div className="space-y-4">
            <section>
              <p className="eyebrow mb-1">Quem indicou</p>
              {lead.referrer ? (
                <Link className="block rounded-sm border border-line px-3 py-2 hover:bg-surface-2" href={`?id=${lead.referrer.id}`} scroll={false}>
                  <span className="mono text-fg-3">{boraId(lead.referrer.bora_number)}</span> {lead.referrer.name} <span className="text-fg-3">· {lead.referrer.city} {lead.referrer.state}</span>
                </Link>
              ) : <p className="text-fg-3">Chegou sem indicação.</p>}
            </section>
            <section>
              <p className="eyebrow mb-1">Rede</p>
              <KV k="Cliques no link" v={lead.referral_clicks} mono />
              <KV k="Cadastros diretos" v={lead.network.signups} mono />
              <KV k="Rede (todos os níveis)" v={lead.network.network} mono />
              <Link href={`/builder/indicacoes?codigo=${lead.referral_code}`} className="eyebrow mt-2 inline-block hover:text-fg">ver árvore →</Link>
            </section>
            <section>
              <p className="eyebrow mb-1">Trouxe ({lead.referred.length})</p>
              <ul className="divide-y divide-line">
                {lead.referred.map((r) => (
                  <li key={r.id}><Link href={`?id=${r.id}`} scroll={false} className="flex justify-between gap-2 py-1.5 hover:text-fg">
                    <span><span className="mono text-fg-3">{boraId(r.bora_number)}</span> {r.name}</span><span className="text-fg-3">{date(r.created_at)}</span>
                  </Link></li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {tab === "Respostas" && (
          Object.keys(lead.answers).length ? (
            <div>{Object.entries(QUESTION_LABEL).filter(([k]) => lead.answers[k]).map(([k, label]) => <KV key={k} k={label} v={lead.answers[k]} />)}</div>
          ) : <p className="text-fg-3">Ainda não respondeu a qualificação.</p>
        )}

        {tab === "Eventos" && (
          <ol className="space-y-0">
            {lead.events.map((e, i) => (
              <li key={i} className="flex gap-3 border-b border-line py-1.5">
                <span className="mono w-[118px] shrink-0 text-[11px] text-fg-3">{dateTime(e.at)}</span>
                <span className="min-w-0 truncate">{EVENT_LABEL[e.name] ?? e.name}</span>
              </li>
            ))}
            {!lead.events.length && <p className="text-fg-3">Sem eventos ligados a este cadastro.</p>}
          </ol>
        )}

        {tab === "Histórico" && (
          <ol>
            {lead.history.map((h, i) => (
              <li key={i} className="border-b border-line py-2">
                <p className="flex justify-between gap-2"><span>{h.action === "pii.revealed" ? "Contato revelado" : h.action === "insert" ? "Cadastro criado" : h.action === "update" ? "Alterado" : h.action}</span><span className="mono text-[11px] text-fg-3">{dateTime(h.at)}</span></p>
                <p className="text-fg-3">por {h.actor}</p>
                {h.action === "update" && h.after && (
                  <p className="mono mt-1 text-[11px] text-fg-2">{Object.keys(h.after).filter((k) => !["updated_by"].includes(k)).map((k) => `${k}: ${fmt(h.before?.[k])} → ${fmt(h.after?.[k])}`).join(" · ")}</p>
                )}
              </li>
            ))}
            {!lead.history.length && <p className="text-fg-3">Sem alterações registradas.</p>}
          </ol>
        )}
      </div>
    </aside>
  );
}

const fmt = (v: unknown) => (v == null ? "∅" : typeof v === "object" ? "…" : String(v));

function NotesList({ notes }: { notes: LeadDetail["notes"] }) {
  return (
    <ul className="space-y-2">
      {notes.map((n) => (
        <li key={n.id} className="rounded-sm border border-line px-3 py-2">
          <p className="whitespace-pre-wrap">{n.body}</p>
          <p className="mono mt-1 text-[11px] text-fg-3">{n.author ?? "—"} · {dateTime(n.at)}</p>
        </li>
      ))}
    </ul>
  );
}

function NotesBox({ lead }: { lead: LeadDetail }) {
  const [body, setBody] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  return (
    <section>
      <p className="eyebrow mb-1">Notas internas</p>
      <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addNote(lead.id, body); if (r.ok) { setBody(""); router.refresh(); } }); }} className="mb-2 flex gap-2">
        <input value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} placeholder="Registrar contato, combinado, contexto…" maxLength={4000} />
        <Button disabled={busy || !body.trim()}>Salvar</Button>
      </form>
      <NotesList notes={lead.notes} />
    </section>
  );
}

function TagsBox({ lead }: { lead: LeadDetail }) {
  const [v, setV] = useState((lead.tags ?? []).join(", "));
  const [busy, start] = useTransition();
  const router = useRouter();
  const changed = v !== (lead.tags ?? []).join(", ");
  return (
    <section>
      <p className="eyebrow mb-1">Etiquetas</p>
      <div className="flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} className={inputCls} placeholder="ex.: captain, prioridade, empresa" />
        <Button disabled={busy || !changed} onClick={() => start(async () => { const r = await setTags(lead.id, v.split(",")); if (r.ok) router.refresh(); })}>Salvar</Button>
      </div>
    </section>
  );
}

function EditForm({ lead, canPii, onDone, onCancel }: { lead: LeadDetail; canPii: boolean; onDone: () => void; onCancel: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const patch: Record<string, string | boolean> = {};
      for (const k of ["first_name", "last_name", "cep", "sex", ...(canPii ? ["email", "phone", "cpf", "birth_date"] : [])]) {
        const v = String(f.get(k) ?? "");
        const orig = String((lead as unknown as Record<string, unknown>)[k] ?? "");
        if (v !== orig) patch[k] = v;
      }
      const mk = f.get("marketing_consent") === "on";
      if (mk !== lead.marketing_consent) patch.marketing_consent = mk;
      start(async () => { const r = await updateLead(lead.id, patch); if (!r.ok) setErr(r.error); else onDone(); });
    }}>
      {err && <p className="rounded-sm border border-danger/40 bg-danger-soft px-3 py-2 text-danger">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nome"><input name="first_name" defaultValue={lead.first_name} className={inputCls} required /></Field>
        <Field label="Sobrenome"><input name="last_name" defaultValue={lead.last_name} className={inputCls} required /></Field>
      </div>
      {canPii ? (
        <>
          <Field label="E-mail"><input name="email" type="email" defaultValue={lead.email} className={inputCls} required /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="WhatsApp"><input name="phone" defaultValue={lead.phone} className={`${inputCls} mono`} required /></Field>
            <Field label="CPF"><input name="cpf" defaultValue={lead.cpf ?? ""} className={`${inputCls} mono`} /></Field>
          </div>
          <Field label="Nascimento"><input name="birth_date" type="date" defaultValue={lead.birth_date ?? ""} className={inputCls} /></Field>
        </>
      ) : <p className="text-fg-3">Para editar contato e documentos, revele o contato antes (exige permissão).</p>}
      <div className="grid grid-cols-2 gap-2">
        <Field label="CEP"><input name="cep" defaultValue={lead.cep} className={`${inputCls} mono`} /></Field>
        <Field label="Sexo">
          <select name="sex" defaultValue={lead.sex ?? ""} className={inputCls}>
            <option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="N">Prefere não dizer</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" name="marketing_consent" defaultChecked={lead.marketing_consent} />Aceita contato de marketing</label>
      <div className="flex gap-2 pt-1">
        <Button variant="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
      <p className="text-[11.5px] text-fg-3">Cidade e UF vêm do cadastro original. Toda alteração entra no histórico.</p>
    </form>
  );
}
