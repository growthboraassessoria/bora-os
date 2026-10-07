// Cliente Supabase do servidor, com a sessão do membro. O RLS vale sempre.
// Os cookies de sessão são httpOnly: o navegador nunca lê o token.
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias");
  return { url, anon };
}

export async function createClient() {
  const store = await cookies();
  const { url, anon } = supabaseEnv();
  return createServerClient(url, anon, {
    cookieOptions: COOKIE_BASE,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, { ...options, ...COOKIE_BASE });
        } catch {
          // Chamado durante a renderização de um Server Component: o proxy renova a sessão.
        }
      },
    },
  });
}

export type Db = Awaited<ReturnType<typeof createClient>>;
