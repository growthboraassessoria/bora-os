// Formatos em pt-BR. Datas no fuso de Brasília.
const TZ = "America/Sao_Paulo";

export const num = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("pt-BR").format(n));
export const pct = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "—" : `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)}%`;
export const ratio = (a: number | null | undefined, b: number | null | undefined) => (a == null || !b ? null : (a / b) * 100);
export const dec = (n: number | null | undefined, d = 2) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

export function date(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}
export function dateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
export function time(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
}
export function ago(iso: string | null | undefined) {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} d`;
}

export const boraId = (n: number | null | undefined) => (n ? `#${String(n).padStart(4, "0")}` : "#----");

/** Variação contra o período anterior, em %. */
export function delta(cur: number | null | undefined, prev: number | null | undefined) {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export function phone(p: string | null | undefined) {
  if (!p) return "—";
  if (p.includes("•")) return p;
  const d = p.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}
export function cpf(c: string | null | undefined) {
  if (!c) return "—";
  if (c.includes("•")) return c;
  return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
export const cep = (c: string | null | undefined) => (c ? c.replace(/(\d{5})(\d{3})/, "$1-$2") : "—");

/** Períodos do seletor da barra superior. */
export const PERIODS = [
  { id: "hoje", label: "Hoje", days: 1 },
  { id: "7d", label: "7 dias", days: 7 },
  { id: "30d", label: "30 dias", days: 30 },
  { id: "90d", label: "90 dias", days: 90 },
] as const;
export type PeriodId = (typeof PERIODS)[number]["id"];

export function periodRange(id: string | undefined) {
  const p = PERIODS.find((x) => x.id === id) ?? PERIODS[2];
  const to = new Date();
  let from: Date;
  if (p.id === "hoje") {
    const s = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(to);
    from = new Date(`${s}T00:00:00-03:00`);
  } else from = new Date(to.getTime() - p.days * 86400_000);
  return { id: p.id, label: p.label, from: from.toISOString(), to: to.toISOString() };
}
