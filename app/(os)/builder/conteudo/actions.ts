"use server";
import { revalidatePath } from "next/cache";
import { actionAuth } from "@/lib/auth";
import { rpc } from "@/lib/builder";
import { fail, type ActionResult } from "@/lib/errors";
import { SEO_FIELDS, contentFieldsFor } from "@/lib/contentSchema";
import { notifySite } from "@/lib/revalidate";

function clean(route: string, seo: Record<string, unknown>, content: Record<string, unknown>) {
  const s: Record<string, unknown> = {};
  for (const f of SEO_FIELDS) {
    const v = seo[f.key];
    if (f.kind === "bool") { if (v === true) s[f.key] = true; continue; }
    const t = String(v ?? "").trim();
    if (!t) continue;
    if (f.kind === "url" && !/^https:\/\//.test(t)) throw new Error(`invalido: ${f.label} precisa começar com https://`);
    s[f.key] = f.max ? t.slice(0, f.max) : t;
  }
  const c: Record<string, unknown> = {};
  for (const f of contentFieldsFor(route)) {
    const t = String(content[f.key] ?? "").trim();
    if (!t) continue;
    c[f.key] = f.kind === "lines" ? t.split("\n").map((l) => l.trim().slice(0, f.max ?? 80)).filter(Boolean).slice(0, 4) : t.slice(0, f.max ?? 500);
  }
  return { s, c };
}

export async function saveDraft(pageId: string, route: string, seo: Record<string, unknown>, content: Record<string, unknown>, note: string): Promise<ActionResult<{ id: string }>> {
  try {
    const a = await actionAuth("builder.sites.edit");
    const { s, c } = clean(route, seo, content);
    const v = await rpc<{ id: string }>(a.db, "save_draft", { p_page: pageId, p_seo: s, p_content: c, p_note: note.slice(0, 200) || null });
    revalidatePath("/builder/conteudo");
    return { ok: true, data: { id: v.id } };
  } catch (e) {
    const m = (e as Error).message;
    return m.startsWith("invalido: ") ? { ok: false, error: m.slice(10) } : fail(e);
  }
}

export async function publishVersion(versionId: string): Promise<ActionResult<{ notified: boolean; reason?: string }>> {
  try {
    const a = await actionAuth("builder.sites.publish");
    const v = await rpc<{ site_id: string; route: string }>(a.db, "publish", { p_version: versionId });
    const { data: site } = await a.db.schema("builder").from("sites").select("revalidate_url").eq("id", v.site_id).single();
    const n = await notifySite(site?.revalidate_url ?? null, { site: v.site_id, route: v.route, kind: "page" });
    revalidatePath("/builder/conteudo");
    return { ok: true, data: { notified: n.ok, reason: n.ok ? undefined : n.reason } };
  } catch (e) {
    return fail(e);
  }
}
