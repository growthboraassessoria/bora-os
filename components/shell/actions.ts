"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleTheme() {
  const store = await cookies();
  const next = store.get("bos_theme")?.value === "light" ? "dark" : "light";
  store.set("bos_theme", next, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/", "layout");
}

export type QuickHit = {
  id: string;
  bora_number: number;
  name: string;
  city: string;
  state: string;
  code: string;
  photo_url?: string | null;
  source?: string | null;
  founder?: boolean;
};

const UF = new Set(["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"]);

function parseQuery(term: string): { q?: string; uf?: string } {
  const parts = term.split(/\s+/).filter(Boolean);
  const last = parts.at(-1)?.toUpperCase();
  if (last && last.length === 2 && UF.has(last)) {
    const rest = parts.slice(0, -1).join(" ");
    return rest ? { q: rest, uf: last } : { uf: last };
  }
  return { q: term };
}

function rankHits(hits: QuickHit[], term: string): QuickHit[] {
  const n = term.replace(/^#/, "").toLocaleLowerCase("pt-BR");
  const score = (h: QuickHit) => {
    const name = h.name.toLocaleLowerCase("pt-BR");
    const city = h.city.toLocaleLowerCase("pt-BR");
    const code = h.code.toLocaleLowerCase("pt-BR");
    if (String(h.bora_number) === n) return 0;
    if (name.startsWith(n)) return 1;
    if (name.split(" ").some((p) => p.startsWith(n))) return 2;
    if (name.includes(n)) return 3;
    if (city.startsWith(n)) return 4;
    if (city.includes(n) || h.state.toUpperCase() === n.toUpperCase()) return 5;
    if (code.startsWith(n)) return 6;
    return 7;
  };
  return [...hits].sort((a, b) => score(a) - score(b) || a.bora_number - b.bora_number);
}

/** Busca rápida (⌘K): nome, BORA ID, código, cidade, UF; e-mail, telefone e CPF só com permissão (o banco confere). */
export async function quickSearch(q: string): Promise<{ hits: QuickHit[]; total: number; error: string | null }> {
  const term = q.trim();
  const numeric = /^#?\d+$/.test(term);
  if (!numeric && term.length < 2) return { hits: [], total: 0, error: null };
  if (numeric && term.replace("#", "").length < 1) return { hits: [], total: 0, error: null };
  const parsed = numeric ? { q: term } : parseQuery(term);
  const db = await createClient();
  const { data, error } = await db.schema("builder").rpc("search_leads", { f: { ...parsed, limit: 10 } });
  if (error || !data) return { hits: [], total: 0, error: "Não foi possível buscar agora." };
  const pack = data as { total?: number; rows?: Record<string, unknown>[] };
  const hits = (pack.rows ?? []).map((r) => {
    const utm = r.utm as { source?: string | null } | undefined;
    return {
      id: String(r.id),
      bora_number: Number(r.bora_number),
      name: `${r.first_name} ${r.last_name}`,
      city: String(r.city ?? ""),
      state: String(r.state ?? ""),
      code: String(r.referral_code ?? ""),
      photo_url: (r.photo_url as string | null) ?? null,
      source: utm?.source ?? null,
      founder: Boolean(r.founder),
    };
  });
  return { hits: rankHits(hits, term), total: Number(pack.total ?? hits.length), error: null };
}
