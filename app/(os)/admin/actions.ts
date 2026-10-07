"use server";
// Admin: membros, papéis, escopo, senha provisória, segundo fator e sessões.
// Toda ação confere a permissão com a sessão do membro; a chave de serviço só entra onde o Auth exige.
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { actionAuth, assertStepUp } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { fail, type ActionResult } from "@/lib/errors";

function tempPassword() {
  const b = randomBytes(18).toString("base64url");
  return `Bora-${b.slice(0, 6)}!${b.slice(6, 12)}#${b.slice(12, 16)}9a`;
}

const UF = /^[A-Z]{2}$/;
const NewMember = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  full_name: z.string().trim().min(3, "Nome completo").max(80),
  role: z.string().min(2),
  ufs: z.array(z.string().regex(UF)).max(27),
});

export async function createMember(input: unknown): Promise<ActionResult<{ password: string }>> {
  try {
    await actionAuth("admin.members.manage");
    const a = await assertStepUp();
    const p = NewMember.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    if (p.data.role === "owner" && !a.perms.has("admin.security.manage")) return { ok: false, error: "Só um proprietário cria outro proprietário." };
    const admin = adminClient();
    const password = tempPassword();
    const { data, error } = await admin.auth.admin.createUser({ email: p.data.email, password, email_confirm: true, user_metadata: { full_name: p.data.full_name } });
    if (error) return { ok: false, error: /already/i.test(error.message) ? "Já existe um acesso com esse e-mail." : error.message };
    const r = await admin.schema("os").rpc("admin_upsert_member", {
      p_actor: a.member.user_id, p_user_id: data.user.id, p_email: p.data.email, p_full_name: p.data.full_name,
      p_role_slugs: [p.data.role], p_ufs: p.data.ufs.length ? p.data.ufs : null, p_must_change: true,
    });
    if (r.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw r.error;
    }
    revalidatePath("/admin/membros");
    return { ok: true, data: { password } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMemberAccess(userId: string, roleIds: string[], ufs: string[]): Promise<ActionResult> {
  try {
    await actionAuth("admin.members.manage");
    const a = await assertStepUp();
    if (userId === a.member.user_id) return { ok: false, error: "Ninguém altera o próprio acesso. Peça a outro admin." };
    if (ufs.some((u) => !UF.test(u))) return { ok: false, error: "UF inválida." };
    const os = a.db.schema("os");
    const { data: cur } = await os.from("member_roles").select("role_id").eq("user_id", userId);
    const have = new Set((cur ?? []).map((r) => r.role_id));
    const want = new Set(roleIds);
    const add = [...want].filter((r) => !have.has(r)).map((role_id) => ({ user_id: userId, role_id }));
    const del = [...have].filter((r) => !want.has(r));
    if (add.length) { const { error } = await os.from("member_roles").insert(add); if (error) throw error; }
    if (del.length) { const { error } = await os.from("member_roles").delete().eq("user_id", userId).in("role_id", del); if (error) throw error; }
    const { error } = await os.from("member_scopes").upsert({ user_id: userId, ufs: ufs.length ? ufs : null }, { onConflict: "user_id" });
    if (error) throw error;
    revalidatePath("/admin/membros");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setMemberStatus(userId: string, status: "active" | "suspended"): Promise<ActionResult> {
  try {
    await actionAuth("admin.members.manage");
    const a = await assertStepUp();
    const { error } = await a.db.schema("os").from("members").update({ status }).eq("user_id", userId);
    if (error) throw error;
    revalidatePath("/admin/membros");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resetPassword(userId: string): Promise<ActionResult<{ password: string }>> {
  try {
    await actionAuth("admin.members.manage");
    const a = await assertStepUp();
    if (userId === a.member.user_id) return { ok: false, error: "Troque a sua senha em Minha conta." };
    const admin = adminClient();
    const password = tempPassword();
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
    await admin.schema("os").rpc("admin_flag_password", { p_actor: a.member.user_id, p_user_id: userId });
    await admin.schema("os").rpc("admin_log", { p_actor: a.member.user_id, p_action: "auth.password_reset", p_entity_id: userId, p_meta: {} });
    await a.db.schema("os").rpc("end_sessions", { p_user_id: userId }).then(() => null, () => null);
    revalidatePath("/admin/membros");
    return { ok: true, data: { password } };
  } catch (e) {
    return fail(e);
  }
}

/** Zera o autenticador de alguém (celular perdido). Só proprietário. A pessoa configura de novo no próximo login. */
export async function resetMfa(userId: string): Promise<ActionResult> {
  try {
    await actionAuth("admin.security.manage");
    const a = await assertStepUp();
    if (userId === a.member.user_id) return { ok: false, error: "Peça a outro proprietário para zerar o seu." };
    const admin = adminClient();
    const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
    if (error) throw error;
    for (const f of data.factors) await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
    await admin.schema("os").rpc("admin_log", { p_actor: a.member.user_id, p_action: "auth.mfa_reset", p_entity_id: userId, p_meta: { factors: data.factors.length } });
    const { error: e2 } = await a.db.schema("os").rpc("end_sessions", { p_user_id: userId });
    if (e2) throw e2;
    revalidatePath("/admin/membros");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function endSessions(userId: string, sessionId?: string): Promise<ActionResult<{ n: number }>> {
  try {
    const a = await actionAuth();
    const { data, error } = await a.db.schema("os").rpc("end_sessions", { p_user_id: userId, p_session_id: sessionId ?? null });
    if (error) throw error;
    revalidatePath("/admin/membros");
    revalidatePath("/conta");
    return { ok: true, data: { n: data as number } };
  } catch (e) {
    return fail(e);
  }
}

// ── Papéis ──────────────────────────────────────────────────────────────
const RoleInput = z.object({ name: z.string().trim().min(2).max(40), description: z.string().trim().max(200) });

export async function createRole(input: unknown, copyFrom?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const a = await actionAuth("admin.roles.manage");
    const p = RoleInput.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const os = a.db.schema("os");
    const { data, error } = await os.from("roles").insert({ ...p.data, created_by: a.member.user_id }).select("id").single();
    if (error) throw error;
    if (copyFrom) {
      const { data: perms } = await os.from("role_permissions").select("permission_key").eq("role_id", copyFrom);
      if (perms?.length) await os.from("role_permissions").insert(perms.map((x) => ({ role_id: data.id, permission_key: x.permission_key })));
    }
    revalidatePath("/admin/papeis");
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function setRolePermission(roleId: string, key: string, on: boolean): Promise<ActionResult> {
  try {
    await actionAuth("admin.roles.manage");
    const a = await assertStepUp();
    const os = a.db.schema("os");
    const { error } = on
      ? await os.from("role_permissions").insert({ role_id: roleId, permission_key: key })
      : await os.from("role_permissions").delete().eq("role_id", roleId).eq("permission_key", key);
    if (error) throw error;
    revalidatePath("/admin/papeis");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  try {
    await actionAuth("admin.roles.manage");
    const a = await assertStepUp();
    const { count } = await a.db.schema("os").from("member_roles").select("user_id", { count: "exact", head: true }).eq("role_id", roleId);
    if (count) return { ok: false, error: `Esse papel ainda está com ${count} ${count === 1 ? "membro" : "membros"}.` };
    const { error } = await a.db.schema("os").from("roles").delete().eq("id", roleId);
    if (error) throw error;
    revalidatePath("/admin/papeis");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
