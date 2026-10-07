"use server";
import { revalidatePath } from "next/cache";
import { actionAuth } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/errors";

export async function saveWhatsapp(uf: string, url: string): Promise<ActionResult> {
  try {
    const a = await actionAuth("builder.sites.edit");
    const v = url.trim();
    if (v && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//.test(v)) return { ok: false, error: "Use um link https://chat.whatsapp.com/…" };
    const { error } = await a.db.from("states").update({ whatsapp_url: v || null }).eq("uf", uf);
    if (error) throw error;
    revalidatePath("/builder/cidades");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
