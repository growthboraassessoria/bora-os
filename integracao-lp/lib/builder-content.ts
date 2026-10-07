// Conteúdo publicado no BORA Builder (título, SEO, textos, configurações), lido no servidor da LP.
// Se o banco falhar ou um campo faltar, a LP usa o valor padrão do código: a página nunca cai por causa do Builder.
// Copiar para lp-vamos-em-frente/lib/builder-content.ts.
import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const BUILDER_SITE = "vamos-em-frente";
export const builderTag = (site = BUILDER_SITE) => `builder:${site}`;

type Published = {
  settings: Record<string, unknown>;
  pages: Record<string, { version: number; seo: Record<string, unknown>; content: Record<string, unknown> }>;
};
const EMPTY: Published = { settings: {}, pages: {} };

async function load(site: string): Promise<Published> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return EMPTY;
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.schema("builder").rpc("published_content", { p_site: site });
    if (error || !data) return EMPTY;
    return data as Published;
  } catch {
    return EMPTY;
  }
}

export const getPublished = (site = BUILDER_SITE) =>
  unstable_cache(() => load(site), ["builder-content", site], { tags: [builderTag(site)], revalidate: 300 })();

/** SEO publicado de uma rota, com os padrões do código como reserva. */
export async function getSeo(route: string, defaults: { title?: string; description?: string; og_title?: string }) {
  const seo = (await getPublished()).pages[route]?.seo ?? {};
  const s = (k: string) => (typeof seo[k] === "string" && seo[k] ? (seo[k] as string) : undefined);
  return {
    title: s("title") ?? defaults.title,
    description: s("description") ?? defaults.description,
    og_title: s("og_title") ?? defaults.og_title ?? s("title") ?? defaults.title,
    og_description: s("og_description") ?? s("description") ?? defaults.description,
    og_image: s("og_image"),
    canonical: s("canonical"),
    noindex: seo.noindex === true,
  };
}

/** Texto publicado de um bloco ("hero.sub"), ou o padrão. Campos de várias linhas voltam como lista. */
export async function getText<T extends string | string[]>(route: string, key: string, fallback: T): Promise<T> {
  const v = (await getPublished()).pages[route]?.content?.[key];
  if (Array.isArray(fallback)) return (Array.isArray(v) && v.length ? v : fallback) as T;
  return (typeof v === "string" && v ? v : fallback) as T;
}

/** Configurações do site (meta por cidade, vagas de Fundador, checkout, teste A/B), com padrão. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const v = (await getPublished()).settings[key];
  return (v ?? fallback) as T;
}
