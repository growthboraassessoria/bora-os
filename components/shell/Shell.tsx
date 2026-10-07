"use client";
// Trilho de módulos + navegação do módulo + barra superior. O conteúdo ocupa o resto.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Blocks, Cable, ShieldCheck, UserRound, LogOut, Sun, Moon, Menu, X } from "lucide-react";
import { useState } from "react";
import { MODULES, type NavModule } from "./nav";
import { Shield } from "../Logo";
import { cx } from "../ui";
import { CommandK } from "./CommandK";
import { toggleTheme } from "./actions";

const ICON = { builder: Blocks, mcp: Cable, admin: ShieldCheck, conta: UserRound };

function activeModule(path: string) {
  return MODULES.find((m) => path === m.href || path.startsWith(`/${m.id}`)) ?? MODULES[0];
}

export function Shell({ perms, name, roles, theme, signOut, children }: { perms: string[]; name: string; roles: string[]; theme: "dark" | "light"; signOut: () => Promise<void>; children: React.ReactNode }) {
  const path = usePathname();
  const has = new Set(perms);
  const mod = activeModule(path);
  const [open, setOpen] = useState(false);
  const visible = (m: NavModule) => m.items.some((i) => !i.perm || has.has(i.perm));
  const crumbs = ["BORA OS", mod.label, mod.items.find((i) => (i.exact ? path === i.href : path.startsWith(i.href)))?.label].filter(Boolean);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {/* Trilho */}
      <nav className="hidden w-14 shrink-0 flex-col items-center border-r border-line bg-surface md:flex" aria-label="Módulos">
        <Link href="/builder" className="grid h-12 w-full place-items-center border-b border-line" aria-label="Início">
          <Shield size={17} />
        </Link>
        <div className="flex flex-1 flex-col gap-1 py-2">
          {MODULES.filter((m) => m.id !== "conta" && visible(m)).map((m) => {
            const Icon = ICON[m.icon];
            const on = mod.id === m.id;
            return (
              <Link key={m.id} href={m.href} title={m.label} aria-current={on ? "page" : undefined}
                className={cx("relative grid h-10 w-14 place-items-center text-fg-3 transition-colors hover:text-fg", on && "text-fg")}>
                {on && <span className="absolute inset-y-2 left-0 w-[2px] bg-active" />}
                <Icon size={18} strokeWidth={1.6} />
              </Link>
            );
          })}
        </div>
        <div className="flex flex-col gap-1 border-t border-line py-2">
          <form action={toggleTheme}>
            <button title={theme === "dark" ? "Tema claro" : "Tema escuro"} className="grid h-10 w-14 place-items-center text-fg-3 hover:text-fg">
              {theme === "dark" ? <Sun size={17} strokeWidth={1.6} /> : <Moon size={17} strokeWidth={1.6} />}
            </button>
          </form>
          <Link href="/conta" title="Minha conta" className={cx("grid h-10 w-14 place-items-center text-fg-3 hover:text-fg", mod.id === "conta" && "text-fg")}>
            <UserRound size={17} strokeWidth={1.6} />
          </Link>
          <form action={signOut}>
            <button title="Sair" className="grid h-10 w-14 place-items-center text-fg-3 hover:text-fg">
              <LogOut size={17} strokeWidth={1.6} />
            </button>
          </form>
        </div>
      </nav>

      {/* Navegação do módulo */}
      <aside className={cx("fixed inset-y-0 left-0 z-40 w-56 shrink-0 flex-col border-r border-line bg-surface md:static md:flex", open ? "flex" : "hidden")}>
        <div className="flex h-12 items-center justify-between border-b border-line px-4">
          <p className="eyebrow">{mod.label}</p>
          <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {mod.items.filter((i) => !i.perm || has.has(i.perm)).map((i) => {
            const on = i.exact ? path === i.href : path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href} onClick={() => setOpen(false)}
                className={cx("relative mx-2 flex h-8 items-center rounded-sm px-3 text-fg-2 hover:bg-surface-2 hover:text-fg", on && "bg-surface-2 text-fg")}>
                {on && <span className="absolute inset-y-1.5 left-0 w-[2px] bg-active" />}
                {i.label}
              </Link>
            );
          })}
          <div className="mt-4 border-t border-line px-2 pt-3 md:hidden">
            {MODULES.filter((m) => m.id !== mod.id && visible(m)).map((m) => (
              <Link key={m.id} href={m.href} onClick={() => setOpen(false)} className="flex h-8 items-center rounded-sm px-3 text-fg-2 hover:bg-surface-2">{m.label}</Link>
            ))}
            <form action={signOut}><button className="flex h-8 w-full items-center rounded-sm px-3 text-fg-2 hover:bg-surface-2">Sair</button></form>
          </div>
        </div>
        <div className="border-t border-line px-4 py-3">
          <p className="truncate text-fg">{name}</p>
          <p className="eyebrow mt-0.5 truncate">{roles.join(" · ") || "sem papel"}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-bg px-4">
          <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={18} /></button>
          <p className="mono hidden truncate text-[11px] uppercase tracking-[0.08em] text-fg-3 sm:block">
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && <span className="px-2 text-line-strong">//</span>}
                <span className={i === crumbs.length - 1 ? "text-fg-2" : ""}>{c}</span>
              </span>
            ))}
          </p>
          <div className="ml-auto flex items-center gap-3">
            {has.has("builder.leads.read") && <CommandK canPii={has.has("builder.leads.pii")} />}
            <span className="mono hidden items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-fg-3 lg:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" /> Sessão protegida
            </span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
