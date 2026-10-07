"use server";
import { assertStepUp } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/errors";

export async function changePassword(password: string, again: string): Promise<ActionResult> {
  try {
    const a = await assertStepUp();
    if (password !== again) return { ok: false, error: "As senhas não conferem." };
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password))
      return { ok: false, error: "Use 12+ caracteres com maiúscula, minúscula, número e símbolo." };
    const { error } = await a.db.auth.updateUser({ password });
    if (error) throw error;
    await a.db.schema("os").rpc("log_event", { p_action: "auth.password_changed", p_entity: "os.members", p_entity_id: a.member.user_id, p_meta: {} });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
