// Recebe o aviso do BORA OS quando um conteúdo é publicado e limpa o cache do Builder.
// Corpo assinado com HMAC-SHA256 (cabeçalho x-bora-signature) e horário: assinatura errada ou com mais de 5 minutos é recusada.
// Copiar para lp-vamos-em-frente/app/api/revalidate/route.ts e cadastrar BUILDER_REVALIDATE_SECRET (o mesmo do OS) na Vercel.
import { revalidateTag } from "next/cache";
import { createHmac, timingSafeEqual } from "node:crypto";
import { builderTag } from "@/lib/builder-content";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.BUILDER_REVALIDATE_SECRET;
  if (!secret) return Response.json({ ok: false }, { status: 503 });
  const body = await req.text();
  const sig = req.headers.get("x-bora-signature") ?? "";
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return Response.json({ ok: false }, { status: 401 });

  let payload: { site?: string; ts?: number };
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (!payload.site || !payload.ts || Math.abs(Date.now() - payload.ts) > 5 * 60_000) return Response.json({ ok: false }, { status: 401 });

  revalidateTag(builderTag(payload.site), { expire: 0 });
  return Response.json({ ok: true });
}
