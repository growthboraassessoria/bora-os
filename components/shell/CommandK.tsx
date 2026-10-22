"use client";
import { useEffect, useMemo, useRef, useState, useTransition, type ButtonHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { Dialog } from "radix-ui";
import { quickSearch, type QuickHit } from "./actions";
import { MODULES } from "./nav";
import { Avatar } from "../Avatar";
import { boraId } from "@/lib/format";
import { cx } from "../ui";

const RECENTS_KEY = "bos_search_recent";

function readRecents(): QuickHit[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.slice(0, 5) : [];
  } catch {
    return [];
  }
}
function pushRecent(h: QuickHit) {
  const next = [h, ...readRecents().filter((x) => x.id !== h.id)].slice(0, 5);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

function ready(term: string) {
  const t = term.trim();
  if (/^#?\d+$/.test(t)) return t.replace("#", "").length >= 1;
  return t.length >= 2;
}

function High({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  if (needle.length < 2) return text;
  const i = text.toLocaleLowerCase("pt-BR").indexOf(needle.toLocaleLowerCase("pt-BR"));
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-signal-text">{text.slice(i, i + needle.length)}</span>
      {text.slice(i + needle.length)}
    </>
  );
}

type PageHit = { href: string; label: string; module: string };
type Row =
  | { kind: "lead"; hit: QuickHit; recent?: boolean }
  | { kind: "page"; page: PageHit }
  | { kind: "all"; q: string; total: number };

function RowBtn({ on, children, ...rest }: { on: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      data-sel={on ? "1" : undefined}
      className={cx("relative flex w-full items-center gap-3 px-3 py-2 text-left", on && "bg-surface-2")}
      {...rest}
    >
      {on && <span className="absolute inset-y-1 left-0 w-[2px] bg-active" />}
      {children}
    </button>
  );
}

export function CommandK({ canPii, perms = [], compact = false }: { canPii: boolean; perms?: string[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<QuickHit[]>([]);
  const [total, setTotal] = useState(0);
  const [recents, setRecents] = useState<QuickHit[]>([]);
  const [sel, setSel] = useState(0);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const has = useMemo(() => new Set(perms), [perms]);

  const pages = useMemo(() => {
    const all: PageHit[] = MODULES.flatMap((m) =>
      m.items.filter((i) => !i.perm || has.has(i.perm)).map((i) => ({ href: i.href, label: i.label, module: m.label })),
    );
    const needle = q.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return all.slice(0, 8);
    return all.filter((p) => p.label.toLocaleLowerCase("pt-BR").includes(needle) || p.module.toLocaleLowerCase("pt-BR").includes(needle)).slice(0, 6);
  }, [has, q]);

  const showPages = emptyPages(q, pages, hits);
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (!q.trim()) recents.forEach((hit) => out.push({ kind: "lead", hit, recent: true }));
    hits.forEach((hit) => out.push({ kind: "lead", hit }));
    if (showPages) pages.forEach((page) => out.push({ kind: "page", page }));
    if (q.trim() && ready(q)) out.push({ kind: "all", q: q.trim(), total: total || hits.length });
    return out;
  }, [q, recents, hits, pages, total, showPages]);

  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!open) return;
    if (!ready(q)) {
      setHits([]);
      setTotal(0);
      setErr(null);
      return;
    }
    timer.current = setTimeout(() => {
      start(async () => {
        const r = await quickSearch(q);
        setHits(r.hits);
        setTotal(r.total);
        setErr(r.error);
        setSel(0);
      });
    }, 120);
  }, [q, open]);

  useEffect(() => { setSel(0); }, [q, open]);
  useEffect(() => {
    listRef.current?.querySelector("[data-sel='1']")?.scrollIntoView({ block: "nearest" });
  }, [sel, rows]);

  const goLead = (h: QuickHit) => {
    pushRecent(h);
    setOpen(false);
    router.push(`/builder/cadastros?id=${h.id}`);
  };
  const go = (row: Row) => {
    if (row.kind === "lead") goLead(row.hit);
    if (row.kind === "page") { setOpen(false); router.push(row.page.href); }
    if (row.kind === "all") { setOpen(false); router.push(`/builder/cadastros?q=${encodeURIComponent(row.q)}`); }
  };
  const close = (v: boolean) => {
    setOpen(v);
    if (!v) { setQ(""); setHits([]); setTotal(0); setErr(null); }
    else setRecents(readRecents());
  };

  const placeholder = canPii ? "Nome, BORA ID, código, cidade, UF, e-mail, telefone ou CPF" : "Nome, BORA ID, código, cidade ou UF";
  const searching = pending && ready(q);
  const emptyQuery = !q.trim();
  const noHits = ready(q) && !searching && hits.length === 0 && pages.length === 0 && !err;

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      {compact ? (
        <Dialog.Trigger className="press grid h-8 w-8 place-items-center text-fg" aria-label="Buscar"><Search size={19} /></Dialog.Trigger>
      ) : (
        <Dialog.Trigger className="flex h-8 w-56 items-center gap-2 rounded-sm border border-line bg-surface px-2.5 text-fg-3 hover:border-line-strong hover:text-fg">
          <Search size={14} />
          <span className="flex-1 text-left">Buscar</span>
          <kbd className="mono rounded-xs border border-line px-1 text-[10px]">⌘K</kbd>
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fade-in fixed inset-0 z-[200] bg-[rgba(0,0,0,0.88)]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
          className="fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-[201] flex max-h-[min(560px,calc(100dvh-24px))] w-auto flex-col overflow-hidden rounded-md border border-line-strong bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.75)] outline-none ring-0 focus:outline-none focus-visible:outline-none md:inset-x-auto md:left-1/2 md:top-[12vh] md:w-[560px] md:-translate-x-1/2 md:max-h-[min(640px,76vh)]"
        >
          <Dialog.Title className="sr-only">Buscar no BORA OS</Dialog.Title>
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-3">
            <Search size={15} className="text-fg-3" />
            <input
              ref={inputRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, Math.max(rows.length - 1, 0))); }
                if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                if (e.key === "Enter" && rows[sel]) { e.preventDefault(); go(rows[sel]); }
              }}
              placeholder={placeholder}
              className="h-12 flex-1 bg-transparent text-[14px] text-fg outline-none ring-0 placeholder:text-fg-3 focus:outline-none focus-visible:outline-none"
            />
            {searching ? <span className="eyebrow">buscando</span> : <kbd className="mono hidden rounded-xs border border-line px-1 text-[10px] text-fg-3 md:inline">esc</kbd>}
          </div>

          <div ref={listRef} className="min-h-[200px] flex-1 overflow-y-auto py-1">
            {emptyQuery && recents.length > 0 && <p className="eyebrow px-3 pb-1 pt-2">Recentes</p>}
            {emptyQuery && recents.map((h) => {
              const idx = rows.findIndex((r) => r.kind === "lead" && r.recent && r.hit.id === h.id);
              const on = idx === sel;
              return (
                <RowBtn key={`r-${h.id}`} on={on} onMouseEnter={() => setSel(idx)} onClick={() => goLead(h)}>
                  <Avatar name={h.name} url={h.photo_url} size={28} />
                  <span className="min-w-0 flex-1 truncate text-fg">{h.name}</span>
                  <span className="mono shrink-0 text-[11px] text-fg-3">{boraId(h.bora_number)}</span>
                </RowBtn>
              );
            })}
            {ready(q) && <p className="eyebrow px-3 pb-1 pt-2">{searching ? "Buscando cadastros" : hits.length ? `Cadastros · ${total || hits.length}` : "Cadastros"}</p>}
            {hits.map((h) => {
              const idx = rows.findIndex((r) => r.kind === "lead" && !r.recent && r.hit.id === h.id);
              const on = idx === sel;
              return (
                <RowBtn key={h.id} on={on} onMouseEnter={() => setSel(idx)} onClick={() => goLead(h)}>
                  <Avatar name={h.name} url={h.photo_url} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fg"><High text={h.name} q={q} /></span>
                    <span className="mt-0.5 block truncate text-[11px] text-fg-3">{h.city}{h.state ? ` · ${h.state}` : ""}{h.source ? ` · ${h.source}` : ""}{h.founder ? " · Fundador" : ""}</span>
                  </span>
                  <span className="mono shrink-0 text-[11px] text-fg-3">{boraId(h.bora_number)}</span>
                </RowBtn>
              );
            })}
            {err && <p className="px-3 py-4 text-center text-[12px] text-danger">{err}</p>}
            {noHits && <p className="px-3 py-6 text-center text-fg-3">Nenhum cadastro com “{q.trim()}”.</p>}
            {ready(q) && !searching && hits.length === 0 && pages.length > 0 && !err && (
              <p className="px-3 pb-2 text-[12px] text-fg-3">Nenhum cadastro. Páginas que batem:</p>
            )}

            {showPages && (
              <>
                <p className="eyebrow px-3 pb-1 pt-3">Páginas</p>
                {pages.map((p) => {
                  const idx = rows.findIndex((r) => r.kind === "page" && r.page.href === p.href && r.page.label === p.label);
                  const on = idx === sel;
                  return (
                    <RowBtn key={p.module + p.href} on={on} onMouseEnter={() => setSel(idx)} onClick={() => go({ kind: "page", page: p })}>
                      <span className="eyebrow w-16 shrink-0">{p.module}</span>
                      <span className="flex-1 truncate text-fg"><High text={p.label} q={q} /></span>
                      <ArrowRight size={13} className="text-fg-3" />
                    </RowBtn>
                  );
                })}
              </>
            )}
            {rows.some((r) => r.kind === "all") && (() => {
              const idx = rows.findIndex((r) => r.kind === "all");
              const on = idx === sel;
              const row = rows[idx];
              if (!row || row.kind !== "all") return null;
              return (
                <RowBtn on={on} onMouseEnter={() => setSel(idx)} onClick={() => go(row)}>
                  <Search size={14} className="text-fg-3" />
                  <span className="flex-1 text-fg">{hits.length ? "Ver todos em Cadastros" : "Buscar em Cadastros"}</span>
                  {row.total > 0 && <span className="num text-[11px] text-fg-3">{row.total}</span>}
                </RowBtn>
              );
            })()}
          </div>

          <div className="flex shrink-0 items-center gap-3 border-t border-line px-3 py-1.5 text-[11px] text-fg-3">
            <span className="inline-flex items-center gap-1"><kbd className="mono rounded-xs border border-line px-1">↑↓</kbd> navegar</span>
            <span className="inline-flex items-center gap-1"><kbd className="mono inline-flex items-center rounded-xs border border-line px-1"><CornerDownLeft size={10} /></kbd> abrir</span>
            <span className="ml-auto hidden md:inline">esc fecha</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function emptyPages(q: string, pages: PageHit[], hits: QuickHit[]) {
  if (!q.trim()) return true;
  if (pages.length === 0) return false;
  return hits.length === 0;
}
