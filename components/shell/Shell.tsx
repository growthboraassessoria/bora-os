"use client";
// Casca do sistema.
// Computador: trilho de módulos + navegação do módulo + barra superior.
// Celular: como um app de iOS — barra de título no topo, abas embaixo e a folha "Mais" com o resto.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Blocks, Cable, ShieldCheck, UserRound, LogOut, Sun, Moon, LayoutDashboard, Users, Share2, Radio, Ellipsis, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { MODULES, type NavModule } from "./nav";
import { Shield, Logo } from "../Logo";
import { cx } from "../ui";
import { CommandK } from "./CommandK";
import { toggleTheme } from "./actions";

const ICON = { builder: Blocks, mcp: Cable, admin: ShieldCheck, conta: UserRound };

const TABS = [
  { href: "/builder", label: "Painel", icon: LayoutDashboard, perm: "builder.dashboard.read", exact: true },
  { href: "/builder/cadastros", label: "Cadastros", icon: Users, perm: "builder.leads.read" },
  { href: "/builder/indicacoes", label: "Indicações", icon: Share2, perm: "builder.referrals.read" },
  { href: "/builder/eventos", label: "Ao vivo", icon: Radio, perm: "builder.analytics.read" },
] as const;

function activeModule(path: string) {
  return MODULES.find((m) => path === m.href || path.startsWith(`/${m.id}`)) ?? MODULES[0];
}

export function Shell({ perms, name, roles, theme, signOut, children }: { perms: string[]; name: string; roles: string[]; theme: "dark" | "light"; signOut: () => Promise<void>; children: React.ReactNode }) {
  const path = usePathname();
  const has = new Set(perms);
  const mod = activeModule(path);
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const visible = (m: NavModule) => m.items.some((i) => !i.perm || has.has(i.perm));
  const current = mod.items.find((i) => (i.exact ? path === i.href : path.startsWith(i.href)));
  const crumbs = ["BORA OS", mod.label, current?.label].filter(Boolean);
  const tabs = TABS.filter((t) => has.has(t.perm));
  const tabOn = (t: (typeof TABS)[number]) => ("exact" in t && t.exact ? path === t.href : path.startsWith(t.href));
  const inTabs = tabs.some(tabOn);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {/* ── Computador: trilho ── */}
      <nav className="hidden w-14 shrink-0 flex-col items-center border-r border-line bg-surface md:flex" aria-label="Módulos">
        <Link href="/builder" className="grid h-12 w-full place-items-center border-b border-line" aria-label="Início">
          <Shield size={16} />
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
            <button title="Sair" className="grid h-10 w-14 place-items-center text-fg-3 hover:text-fg"><LogOut size={17} strokeWidth={1.6} /></button>
          </form>
        </div>
      </nav>

      {/* ── Computador: navegação do módulo ── */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex h-12 items-center border-b border-line px-4"><Logo height={14} /></div>
        <p className="eyebrow px-4 pb-1 pt-4">{mod.label}</p>
        <div className="flex-1 overflow-y-auto pb-2">
          {mod.items.filter((i) => !i.perm || has.has(i.perm)).map((i) => {
            const on = i.exact ? path === i.href : path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href}
                className={cx("relative mx-2 flex h-8 items-center rounded-sm px-3 text-fg-2 hover:bg-surface-2 hover:text-fg", on && "bg-surface-2 text-fg")}>
                {on && <span className="absolute inset-y-1.5 left-0 w-[2px] bg-active" />}
                {i.label}
              </Link>
            );
          })}
        </div>
        <div className="border-t border-line px-4 py-3">
          <p className="truncate text-fg">{name}</p>
          <p className="eyebrow mt-0.5 truncate">{roles.join(" · ") || "sem papel"}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Computador: barra superior ── */}
        <header className="hidden h-12 shrink-0 items-center gap-3 border-b border-line bg-bg px-4 md:flex">
          <p className="mono truncate text-[11px] uppercase tracking-[0.08em] text-fg-3">
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

        {/* ── Celular: barra de título ── */}
        <header className="glass pt-safe sticky top-0 z-30 shrink-0 border-b border-line md:hidden">
          <div className="flex h-11 items-center gap-3 px-4">
            <Link href="/builder" aria-label="Início" className="press"><Shield size={15} /></Link>
            <p className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold">{current?.label ?? mod.label}</p>
            {has.has("builder.leads.read") ? <CommandK canPii={has.has("builder.leads.pii")} compact /> : <span className="w-6" />}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">{children}</main>

        {/* ── Celular: abas ── */}
        <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line md:hidden" aria-label="Abas">
          <div className="grid h-[56px]" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
            {tabs.map((t) => {
              const on = tabOn(t);
              const Icon = t.icon;
              return (
                <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
                  className={cx("press flex flex-col items-center justify-center gap-1 text-[10.5px]", on ? "text-fg" : "text-fg-3")}>
                  <span className={cx("grid h-7 w-12 place-items-center rounded-full", on && "bg-signal text-signal-ink")}><Icon size={19} strokeWidth={on ? 2 : 1.6} /></span>
                  {t.label}
                </Link>
              );
            })}
            <button onClick={() => setMore(true)} className={cx("press flex flex-col items-center justify-center gap-1 text-[10.5px]", !inTabs ? "text-fg" : "text-fg-3")}>
              <span className={cx("grid h-7 w-12 place-items-center rounded-full", !inTabs && "bg-signal text-signal-ink")}><Ellipsis size={19} /></span>
              Mais
            </button>
          </div>
        </nav>
      </div>

      {/* ── Celular: folha "Mais" ── */}
      {more && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mais">
          <button className="fade-in absolute inset-0 bg-black/50" onClick={() => setMore(false)} aria-label="Fechar" />
          <div className="sheet-up pb-safe absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[14px] bg-surface">
            <div className="sticky top-0 z-10 bg-surface pt-2">
              <div className="mx-auto h-1 w-9 rounded-full bg-line-strong" />
              <div className="flex items-center justify-between px-4 py-3">
                <Logo height={14} />
                <button onClick={() => setMore(false)} className="press grid h-8 w-8 place-items-center rounded-full bg-surface-3" aria-label="Fechar"><X size={16} /></button>
              </div>
            </div>
            <div className="space-y-5 px-4 pb-6">
              {MODULES.filter(visible).map((m) => (
                <section key={m.id}>
                  <p className="eyebrow mb-1.5 px-3">{m.label}</p>
                  <ul className="overflow-hidden rounded-[12px] bg-surface-2">
                    {m.items.filter((i) => !i.perm || has.has(i.perm)).map((i) => {
                      const on = i.exact ? path === i.href : path.startsWith(i.href);
                      return (
                        <li key={i.href} className="border-b border-line last:border-0">
                          <Link href={i.href} className="press flex h-12 items-center justify-between px-3 text-[15px]">
                            <span className={on ? "font-semibold text-fg" : "text-fg"}>{i.label}</span>
                            <span className="flex items-center gap-2">{on && <span className="h-1.5 w-1.5 rounded-full bg-signal" />}<ChevronRight size={16} className="text-fg-3" /></span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              <ul className="overflow-hidden rounded-[12px] bg-surface-2">
                <li className="border-b border-line">
                  <form action={toggleTheme}>
                    <button className="press flex h-12 w-full items-center justify-between px-3 text-[15px]">
                      <span>Tema {theme === "dark" ? "claro" : "escuro"}</span>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                  </form>
                </li>
                <li>
                  <form action={signOut}>
                    <button className="press flex h-12 w-full items-center justify-between px-3 text-[15px] text-danger"><span>Sair</span><LogOut size={17} /></button>
                  </form>
                </li>
              </ul>
              <p className="text-center text-[12px] text-fg-3">{name} · {roles.join(" · ") || "sem papel"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
