"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionAuth } from "@/lib/auth";
import { rpc, SITE_ID } from "@/lib/builder";
import { fail, type ActionResult } from "@/lib/errors";
import { notifySite } from "@/lib/revalidate";

const httpsOrEmpty = z.string().trim().refine((v) => !v || /^https:\/\/\S+$/.test(v), "Use uma URL https://").optional();
const SettingsSchema = z.object({
  city_goal: z.coerce.number().int().min(10).max(100000).optional(),
  founder_slots: z.coerce.number().int().min(1).max(1000).optional(),
  checkout_url: httpsOrEmpty,
  short_domain: z.string().trim().regex(/^$|^[a-z0-9.-]+\.[a-z]{2,}$/i, "Domínio sem https, ex.: bora.com.br").optional(),
  ga_id: z.string().trim().regex(/^$|^G-[A-Z0-9]{4,}$/, "GA4 no formato G-XXXXXXX").optional(),
  pixel_id: z.string().trim().regex(/^$|^\d{6,20}$/, "Pixel: só números").optional(),
  experiment_hero: z.object({ enabled: z.boolean().optional(), winner: z.enum(["A", "B"]).nullable().optional() }).optional(),
});

export async function saveSettings(input: unknown, notify: boolean): Promise<ActionResult<{ note: string }>> {
  try {
    const a = await actionAuth("builder.sites.edit");
    const p = SettingsSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const clean = Object.fromEntries(Object.entries(p.data).filter(([, v]) => v !== "" && v !== undefined));
    await rpc(a.db, "save_settings", { p_site: SITE_ID, p_settings: clean });
    revalidatePath("/builder/configuracoes");
    if (!notify || !a.perms.has("builder.sites.publish")) return { ok: true, data: { note: "Salvo. A LP lê na próxima publicação." } };
    const { data: site } = await a.db.schema("builder").from("sites").select("revalidate_url").eq("id", SITE_ID).single();
    const n = await notifySite(site?.revalidate_url ?? null, { site: SITE_ID, kind: "settings" });
    return { ok: true, data: { note: n.ok ? "Salvo e a LP foi avisada." : `Salvo no OS. ${n.reason}` } };
  } catch (e) {
    return fail(e);
  }
}

const SiteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  production_url: z.string().trim().regex(/^https:\/\/\S+$/, "URL de produção precisa ser https://"),
  revalidate_url: z.string().trim().regex(/^$|^https:\/\/\S+$/, "URL de revalidação precisa ser https://"),
});

export async function saveSite(input: unknown): Promise<ActionResult> {
  try {
    const a = await actionAuth("builder.sites.edit");
    const p = SiteSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const domain = new URL(p.data.production_url).host;
    const { error } = await a.db.schema("builder").from("sites").update({ ...p.data, revalidate_url: p.data.revalidate_url || null, domain }).eq("id", SITE_ID);
    if (error) throw error;
    revalidatePath("/builder", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function approveTestimonial(id: string, approved: boolean): Promise<ActionResult> {
  try {
    const a = await actionAuth("builder.sites.edit");
    const { error } = await a.db.from("testimonials").update({ approved }).eq("id", id);
    if (error) throw error;
    revalidatePath("/builder/configuracoes");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
