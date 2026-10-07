"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Upload, Save } from "lucide-react";
import { SEO_FIELDS, type FieldDef } from "@/lib/contentSchema";
import { dateTime } from "@/lib/format";
import { Button, Chip, Field, Panel, inputCls, cx } from "@/components/ui";
import { saveDraft, publishVersion } from "../actions";

export type Version = { id: string; version: number; status: "draft" | "published" | "archived"; seo: Record<string, unknown>; content: Record<string, unknown>; note: string | null; created_at: string; published_at: string | null };

type Props = { page: { id: string; route: string; name: string; url: string }; versions: Version[]; seoDefaults: Record<string, string>; contentFields: FieldDef[]; canEdit: boolean; canPublish: boolean };

const toForm = (fields: FieldDef[], data: Record<string, unknown>) =>
  Object.fromEntries(fields.map((f) => [f.key, f.kind === "bool" ? !!data[f.key] : Array.isArray(data[f.key]) ? (data[f.key] as string[]).join("\n") : String(data[f.key] ?? "")]));

export function Editor({ page, versions, seoDefaults, contentFields, canEdit, canPublish }: Props) {
  const draft = versions.find((v) => v.status === "draft");
  const published = versions.find((v) => v.status === "published");
  const base = draft ?? published;
  const [seo, setSeo] = useState<Record<string, string | boolean>>(toForm(SEO_FIELDS, base?.seo ?? {}));
  const [content, setContent] = useState<Record<string, string | boolean>>(toForm(contentFields, base?.content ?? {}));
  const [note, setNote] = useState(draft?.note ?? "");
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "warn"; text: string } | null>(null);
  const [busy, start] = useTransition();
  const router = useRouter();

  const title = String(seo.title || seoDefaults.title || page.name);
  const desc = String(seo.description || seoDefaults.description || "");
  const ogTitle = String(seo.og_title || seoDefaults.og_title || title);
  const dirty = useMemo(() => JSON.stringify([seo, content, note]) !== JSON.stringify([toForm(SEO_FIELDS, base?.seo ?? {}), toForm(contentFields, base?.content ?? {}), draft?.note ?? ""]), [seo, content, note, base, contentFields, draft]);

  const save = (then?: (id: string) => void) => start(async () => {
    const r = await saveDraft(page.id, page.route, seo, content, note);
    if (!r.ok) return setMsg({ tone: "err", text: r.error });
    if (then) then(r.data!.id); else { setMsg({ tone: "ok", text: "Rascunho salvo." }); router.refresh(); }
  });
  const publish = (id: string) => start(async () => {
    const r = await publishVersion(id);
    if (!r.ok) return setMsg({ tone: "err", text: r.error });
    setMsg(r.data!.notified ? { tone: "ok", text: "Publicado e a LP já foi avisada." } : { tone: "warn", text: `Publicado no OS. ${r.data!.reason}` });
    router.refresh();
  });

  const input = (f: FieldDef, state: Record<string, string | boolean>, set: (v: Record<string, string | boolean>) => void, placeholder?: string) => {
    const v = state[f.key];
    if (f.kind === "bool") return <label key={f.key} className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={!!v} onChange={(e) => set({ ...state, [f.key]: e.target.checked })} />{f.label}</label>;
    const len = String(v ?? "").length;
    const common = { value: String(v ?? ""), disabled: !canEdit, placeholder: placeholder ?? f.def ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set({ ...state, [f.key]: e.target.value }) };
    return (
      <Field key={f.key} label={f.label} hint={[f.hint, f.max && f.kind !== "lines" ? `${len}/${f.max}` : null].filter(Boolean).join(" · ") || undefined}>
        {f.kind === "textarea" || f.kind === "lines"
          ? <textarea {...common} rows={f.kind === "lines" ? 3 : 2} className={cx(inputCls, "h-auto py-2", f.kind === "lines" && "mono uppercase")} />
          : <input {...common} className={cx(inputCls, f.kind === "url" && "mono text-[12px]")} />}
      </Field>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <Link href="/builder/conteudo" className="eyebrow mb-3 inline-flex items-center gap-1 hover:text-fg"><ArrowLeft size={12} />páginas</Link>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Conteúdo e SEO · <span className="mono">{page.route}</span></p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-tight">{page.name}</h1>
          <p className="mt-1 flex gap-2">{published ? <Chip tone="signal">no ar: v{published.version}</Chip> : <Chip tone="outline">no ar: padrão da LP</Chip>}{draft && <Chip tone="warning">rascunho v{draft.version}</Chip>}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button disabled={busy || !dirty} onClick={() => save()}><Save size={13} />Salvar rascunho</Button>
            {canPublish && <Button variant="primary" disabled={busy || (!dirty && !draft)} onClick={() => (dirty || !draft ? save(publish) : publish(draft.id))}><Upload size={13} />Publicar</Button>}
          </div>
        )}
      </div>
      {msg && <p className={cx("mb-4 rounded-sm border px-3 py-2", msg.tone === "ok" && "border-line-strong text-fg", msg.tone === "err" && "border-danger/40 bg-danger-soft text-danger", msg.tone === "warn" && "border-warning/40 bg-warning-soft text-warning")}>{msg.text}</p>}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel eyebrow="SEO" title="Busca e compartilhamento">
            <div className="grid gap-3 md:grid-cols-2">
              {SEO_FIELDS.map((f) => <div key={f.key} className={cx((f.kind === "textarea" || f.kind === "url") && "md:col-span-2")}>{input(f, seo, setSeo, seoDefaults[f.key])}</div>)}
            </div>
          </Panel>
          {contentFields.length > 0 && (
            <Panel eyebrow="Textos" title="Blocos da página">
              <div className="grid gap-3 md:grid-cols-2">{contentFields.map((f) => <div key={f.key}>{input(f, content, setContent)}</div>)}</div>
              <p className="mt-3 text-fg-3">Campo vazio = a LP usa o texto padrão (em cinza).</p>
            </Panel>
          )}
          {canEdit && <Field label="Nota desta versão" hint="Opcional. Ex.: novo título para a campanha de outubro."><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} maxLength={200} /></Field>}
        </div>

        <div className="space-y-4">
          <Panel eyebrow="Prévia" title="Resultado no Google">
            <div className="rounded-sm border border-line bg-white p-3 text-black">
              <p className="truncate text-[12px] text-[#4d5156]">{page.url.replace(/^https?:\/\//, "")}</p>
              <p className="truncate text-[17px] leading-snug text-[#1a0dab]">{title}</p>
              <p className="line-clamp-2 text-[12.5px] text-[#4d5156]">{desc || "Sem descrição: o Google escolhe um trecho da página."}</p>
            </div>
            {seo.noindex === true && <p className="mt-2 text-warning">Esta página está marcada para não aparecer no Google.</p>}
          </Panel>
          <Panel eyebrow="Prévia" title="Ao compartilhar">
            <div className="overflow-hidden rounded-sm border border-line">
              <div className="grid aspect-[1200/630] place-items-center bg-surface-3 text-fg-3">
                {seo.og_image ? <img src={String(seo.og_image)} alt="" className="h-full w-full object-cover" /> : <span className="eyebrow">imagem gerada pela LP</span>}
              </div>
              <div className="bg-surface-2 px-3 py-2">
                <p className="mono text-[10.5px] uppercase text-fg-3">{page.url.replace(/^https?:\/\//, "").split("/")[0]}</p>
                <p className="truncate font-semibold">{ogTitle}</p>
                <p className="line-clamp-2 text-fg-2">{String(seo.og_description || desc)}</p>
              </div>
            </div>
          </Panel>
          <Panel eyebrow="Versões" title={`${versions.length} versões`} pad={false}>
            <ol>
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 border-b border-line px-4 py-2 last:border-0">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2"><span className="mono">v{v.version}</span>{v.status === "published" && <Chip tone="signal">no ar</Chip>}{v.status === "draft" && <Chip tone="warning">rascunho</Chip>}</p>
                    <p className="truncate text-[11.5px] text-fg-3">{v.note ?? "sem nota"} · {dateTime(v.published_at ?? v.created_at)}</p>
                  </div>
                  {canPublish && v.status === "archived" && <Button variant="ghost" disabled={busy} onClick={() => confirm(`Voltar para a v${v.version}? Ela vira uma versão nova, publicada.`) && publish(v.id)}><RotateCcw size={13} />Voltar</Button>}
                </li>
              ))}
              {!versions.length && <li className="px-4 py-3 text-fg-3">Nenhuma versão: a LP mostra o padrão dela.</li>}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
