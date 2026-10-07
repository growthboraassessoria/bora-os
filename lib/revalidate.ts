// Avisa a LP que um conteúdo foi publicado. Corpo assinado com HMAC-SHA256 e horário (a LP recusa assinatura errada ou velha).
import "server-only";
import { createHmac } from "node:crypto";

export async function notifySite(revalidateUrl: string | null, payload: { site: string; route?: string; kind: "page" | "settings" }) {
  const secret = process.env.BUILDER_REVALIDATE_SECRET;
  if (!revalidateUrl || !secret) return { ok: false, reason: "LP sem endereço de revalidação configurado." };
  const body = JSON.stringify({ ...payload, ts: Date.now() });
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const r = await fetch(revalidateUrl, { method: "POST", headers: { "content-type": "application/json", "x-bora-signature": sig }, body, signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!r.ok) return { ok: false, reason: r.status === 404 ? "A LP ainda não tem a rota /api/revalidate (contrato do Builder)." : `A LP respondeu ${r.status}.` };
    return { ok: true as const };
  } catch {
    return { ok: false, reason: "A LP não respondeu." };
  }
}
