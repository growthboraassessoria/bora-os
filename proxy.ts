// Roda antes de cada página: renova a sessão do Supabase, aplica a CSP com nonce e
// manda quem não tem sessão para o login. A checagem completa (segundo fator, membro, permissão) é feita no servidor.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC = ["/login", "/api/mcp", "/api/health"];

function csp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  const supabase = process.env.SUPABASE_URL ?? "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} https://brasilapi.com.br https://viacep.com.br${dev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

export async function proxy(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);

  let res = NextResponse.next({ request: { headers } });
  const secure = process.env.NODE_ENV === "production";
  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: { headers } });
        for (const { name, value, options } of list) res.cookies.set(name, value, { ...options, httpOnly: true, secure, sameSite: "lax", path: "/" });
      },
    },
  });
  // Renova o token se preciso. Não decide acesso: isso é do servidor e do RLS.
  const { data } = await supabase.auth.getClaims();

  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));
  if (!data?.claims && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const r = NextResponse.redirect(url);
    r.headers.set("Content-Security-Policy", policy);
    return r;
  }
  res.headers.set("Content-Security-Policy", policy);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/).*)"],
};
