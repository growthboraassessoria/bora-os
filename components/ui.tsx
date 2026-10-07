// Peças da interface. Densas, cantos quase retos, rótulo em mono caixa alta, número em mono.
import Link from "next/link";
import clsx from "clsx";
import { delta as deltaOf, pct } from "@/lib/format";

export function cx(...a: Parameters<typeof clsx>) {
  return clsx(...a);
}

export function Panel({ title, eyebrow, right, children, className, pad = true }: { title?: React.ReactNode; eyebrow?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("rounded-md border border-line bg-surface", className)}>
      {(title || eyebrow || right) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2 className="mt-0.5 truncate text-[13.5px] font-semibold text-fg">{title}</h2>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function PageHead({ eyebrow, title, desc, right }: { eyebrow: string; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="max-md:w-full">
        <p className="eyebrow max-md:hidden">{eyebrow}</p>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-fg">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-fg-2">{desc}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2 max-md:w-full">{right}</div>}
    </div>
  );
}

export function Stat({ label, value, prev, cur, hint, invert, signal }: { label: string; value: React.ReactNode; cur?: number | null; prev?: number | null; hint?: string; invert?: boolean; signal?: boolean }) {
  const d = deltaOf(cur, prev);
  const up = d != null && d > 0;
  return (
    <div className="min-w-0 rounded-md border border-line bg-surface px-4 py-3" title={hint}>
      <p className="eyebrow truncate">{label}</p>
      <p className={cx("num mt-1.5 text-[24px] font-medium leading-none tracking-tight", signal ? "text-signal-text" : "text-fg")}>{value}</p>
      <p className="num mt-2 h-4 truncate text-[11px] text-fg-3" title="Comparado ao período anterior de mesmo tamanho">
        {d == null ? (prev === undefined ? "" : "sem base anterior") : (
          <span className={cx(d === 0 ? "" : (up !== !!invert) ? "text-fg-2" : "text-fg-3")}>
            {up ? "▲" : d < 0 ? "▼" : "■"} {pct(Math.abs(d))}
          </span>
        )}
      </p>
    </div>
  );
}

type Tone = "neutral" | "signal" | "danger" | "warning" | "outline";
export function Chip({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cx(
        "mono inline-flex h-[18px] items-center whitespace-nowrap rounded-xs px-1.5 text-[10px] uppercase tracking-[0.06em]",
        tone === "neutral" && "bg-surface-3 text-fg-2",
        tone === "signal" && "bg-signal text-signal-ink",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "outline" && "border border-line-strong text-fg-2",
        className,
      )}
    >
      {children}
    </span>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const BTN = "press inline-flex h-10 md:h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40";
const VAR: Record<Variant, string> = {
  primary: "bg-signal text-signal-ink hover:brightness-95",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg",
  danger: "border border-danger/40 text-danger hover:bg-danger-soft",
};
export function Button({ variant = "secondary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={cx(BTN, VAR[variant], className)} />;
}
export function LinkButton({ variant = "secondary", className, href, children, ...p }: { variant?: Variant; className?: string; href: string; children: React.ReactNode; prefetch?: boolean }) {
  return (
    <Link href={href} {...p} className={cx(BTN, VAR[variant], className)}>
      {children}
    </Link>
  );
}

export const inputCls =
  "h-11 md:h-8 w-full rounded-[10px] md:rounded-sm border border-line-strong bg-bg px-3 md:px-2.5 text-[13px] text-fg placeholder:text-fg-3 outline-none focus:border-active disabled:opacity-50";

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[12px] text-danger">{error}</span> : hint ? <span className="mt-1 block text-[11.5px] text-fg-3">{hint}</span> : null}
    </label>
  );
}

export function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-1.5 last:border-0">
      <span className="shrink-0 text-fg-3">{k}</span>
      <span className={cx("min-w-0 truncate text-right text-fg", mono && "mono")}>{v}</span>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      <p className="eyebrow">Sem dados</p>
      <p className="text-fg">{title}</p>
      {children && <div className="max-w-md text-fg-3">{children}</div>}
    </div>
  );
}

export function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const w = max > 0 ? Math.max(1, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cx("h-1.5 w-full rounded-xs bg-surface-3", className)}>
      <div className="h-full rounded-xs bg-active" style={{ width: `${w}%` }} />
    </div>
  );
}

export const th = "eyebrow h-8 border-b border-line px-3 text-left font-normal whitespace-nowrap";
export const td = "h-8 border-b border-line px-3 whitespace-nowrap";
