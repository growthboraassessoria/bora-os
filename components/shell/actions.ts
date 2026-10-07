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

export type QuickHit = { id: string; bora_number: number; name: string; city: string; state: string; code: string };

/** Busca rápida (⌘K): nome, BORA ID, código; e-mail, telefone e CPF só com permissão (o banco confere). */
export async function quickSearch(q: string): Promise<QuickHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const db = await createClient();
  const { data, error } = await db.schema("builder").rpc("search_leads", { f: { q: term, limit: 8 } });
  if (error || !data) return [];
  return (data.rows as Record<string, string & number>[]).map((r) => ({
    id: r.id, bora_number: r.bora_number, name: `${r.first_name} ${r.last_name}`, city: r.city, state: r.state, code: r.referral_code,
  }));
}
