"use server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { actionAuth, assertStepUp } from "@/lib/auth";
import { hashToken } from "@/lib/mcp/gateway";
import { fail, type ActionResult } from "@/lib/errors";

export async function createConnection(input: { name: string; permissions: string[]; tools: string[] | null; days: number; ips: string }): Promise<ActionResult<{ token: string }>> {
  try {
    await actionAuth("mcp.connections.manage");
    const a = await assertStepUp();
    const token = "bos_" + randomBytes(30).toString("base64url");
    const ips = input.ips.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    for (const ip of ips) if (!/^[0-9a-f.:]+(\/\d{1,3})?$/i.test(ip)) return { ok: false, error: `IP inválido: ${ip}` };
    const { error } = await a.db.schema("mcp").rpc("create_connection", {
      p_name: input.name.trim(), p_prefix: token.slice(0, 12), p_hash: hashToken(token), p_permissions: input.permissions,
      p_tools: input.tools?.length ? input.tools : null, p_days: Math.round(input.days), p_ips: ips.length ? ips : null,
    });
    if (error) throw error;
    revalidatePath("/mcp");
    return { ok: true, data: { token } };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeConnection(id: string): Promise<ActionResult> {
  try {
    const a = await actionAuth();
    const { error } = await a.db.schema("mcp").rpc("revoke_connection", { p_id: id });
    if (error) throw error;
    revalidatePath("/mcp");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleTool(name: string, enabled: boolean): Promise<ActionResult> {
  try {
    const a = await actionAuth("mcp.connections.manage");
    const { error } = await a.db.schema("mcp").from("tools").update({ enabled }).eq("name", name);
    if (error) throw error;
    revalidatePath("/mcp/ferramentas");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
