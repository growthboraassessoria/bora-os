"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog } from "radix-ui";
import { quickSearch, type QuickHit } from "./actions";
import { boraId } from "@/lib/format";

export function CommandK({ canPii, compact = false }: { canPii: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<QuickHit[]>([]);
  const [sel, setSel] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (compact) return; // o atalho fica só na busca do computador
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
    if (q.trim().length < 2) { setHits([]); return; } // sem busca ao abrir a tela
    timer.current = setTimeout(() => start(async () => { setHits(await quickSearch(q)); setSel(0); }), 180);
  }, [q]);

  const go = (h: QuickHit) => {
    setOpen(false);
    router.push(`/builder/cadastros?id=${h.id}`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {compact ? (
        <Dialog.Trigger className="press grid h-8 w-8 place-items-center text-fg" aria-label="Buscar cadastro"><Search size={19} /></Dialog.Trigger>
      ) : (
        <Dialog.Trigger className="flex h-8 w-56 items-center gap-2 rounded-sm border border-line bg-surface px-2.5 text-fg-3 hover:border-line-strong">
          <Search size={14} />
          <span className="flex-1 text-left">Buscar cadastro</span>
          <kbd className="mono rounded-xs border border-line px-1 text-[10px]">⌘K</kbd>
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 top-0 z-50 overflow-hidden border-line-strong bg-surface pt-[env(safe-area-inset-top)] shadow-[var(--shadow)] md:inset-x-auto md:left-1/2 md:top-[12vh] md:w-[560px] md:-translate-x-1/2 md:rounded-md md:border md:pt-0">
          <Dialog.Title className="sr-only">Buscar cadastro</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search size={15} className="text-fg-3" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
                if (e.key === "Enter" && hits[sel]) go(hits[sel]);
              }}
              placeholder={canPii ? "Nome, BORA ID, código, e-mail, telefone ou CPF" : "Nome, BORA ID ou código"}
              className="h-11 flex-1 bg-transparent outline-none placeholder:text-fg-3"
            />
            {pending && <span className="eyebrow">buscando</span>}
          </div>
          <ul className="max-h-[50vh] overflow-y-auto py-1">
            {hits.map((h, i) => (
              <li key={h.id}>
                <button onMouseEnter={() => setSel(i)} onClick={() => go(h)} className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === sel ? "bg-surface-2" : ""}`}>
                  <span className="mono w-14 text-fg-3">{boraId(h.bora_number)}</span>
                  <span className="flex-1 truncate text-fg">{h.name}</span>
                  <span className="text-fg-3">{h.city} · {h.state}</span>
                  <span className="mono text-[11px] text-fg-3">{h.code}</span>
                </button>
              </li>
            ))}
            {q.trim().length >= 2 && !pending && hits.length === 0 && <li className="px-3 py-6 text-center text-fg-3">Nada encontrado.</li>}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
