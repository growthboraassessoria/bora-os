"use server";
// Login: senha → autenticador (configurar ou confirmar) → senha definitiva no primeiro acesso.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { message } from "@/lib/errors";

export type FormState = { error?: string; ok?: boolean };

// Limite simples por IP e e-mail, por instância, além do limite do próprio Supabase Auth.
const attempts = new Map<string, { n: number; at: number }>();
function tooMany(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.at > 15 * 60_000) {
    attempts.set(key, { n: 1, at: now });
    return false;
  }
  a.n += 1;
  return a.n > 8;
}

/** Depois do segundo fator: senha provisória vai para a troca; senão, para onde a pessoa ia. */
async function afterSecondFactor(db: Awaited<ReturnType<typeof createClient>>, next?: string): Promise<never> {
  const { data: u } = await db.auth.getUser();
  const { data: m } = await db.schema("os").from("members").select("must_change_password").eq("user_id", u.user?.id ?? "").maybeSingle();
  if (m?.must_change_password) redirect("/login/nova-senha");
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/builder");
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Preencha e-mail e senha." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooMany(`${ip}:${email}`)) return { error: "Muitas tentativas. Espere 15 minutos." };

  const db = await createClient();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: message(error ?? "Invalid login credentials") };

  // Só membro ativo passa da senha. A checagem usa a chave de serviço porque, antes do segundo fator, o RLS não libera nada.
  const { data: m } = await adminClient().schema("os").from("members").select("status").eq("user_id", data.user.id).maybeSingle();
  if (!m || m.status !== "active") {
    await db.auth.signOut();
    return { error: "Acesso não liberado. Fale com um admin do BORA OS." };
  }
  await db.schema("os").rpc("log_event", { p_action: "auth.password_ok", p_entity: "os.session", p_entity_id: data.user.id, p_meta: { ip } });
  const verified = (data.user.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified");
  redirect(verified ? "/login/codigo" : "/login/autenticador");
}

export async function verifyCode(_: FormState, form: FormData): Promise<FormState> {
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: "O código tem 6 dígitos." };
  const db = await createClient();
  const { data: f } = await db.auth.mfa.listFactors();
  const factor = f?.totp?.[0];
  if (!factor) redirect("/login/autenticador");
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: message(error) };
  await db.schema("os").rpc("log_event", { p_action: "auth.login", p_entity: "os.session", p_entity_id: null, p_meta: {} });
  return afterSecondFactor(db, String(form.get("next") ?? ""));
}

export async function startEnroll(): Promise<{ factorId?: string; qr?: string; secret?: string; error?: string }> {
  const db = await createClient();
  const { data: u } = await db.auth.getUser();
  if (!u.user) return { error: "Sessão expirada. Entre de novo." };
  const { data: f } = await db.auth.mfa.listFactors();
  if (f?.totp?.length) return { error: "Este acesso já tem autenticador. Use o código." };
  for (const old of f?.all ?? []) if (old.factor_type === "totp" && old.status !== "verified") await db.auth.mfa.unenroll({ factorId: old.id });
  const { data, error } = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: `BORA OS ${new Date().toISOString().slice(0, 10)}`, issuer: "BORA OS" });
  if (error || !data) return { error: message(error) };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmEnroll(_: FormState, form: FormData): Promise<FormState> {
  const factorId = String(form.get("factorId") ?? "");
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (!factorId || code.length !== 6) return { error: "Digite os 6 dígitos que aparecem no aplicativo." };
  const db = await createClient();
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: message(error) };
  await db.schema("os").rpc("log_event", { p_action: "auth.mfa_enrolled", p_entity: "os.session", p_entity_id: null, p_meta: {} });
  await db.schema("os").rpc("log_event", { p_action: "auth.login", p_entity: "os.session", p_entity_id: null, p_meta: {} });
  return afterSecondFactor(db);
}

export async function newPassword(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  const again = String(form.get("again") ?? "");
  if (password !== again) return { error: "As senhas não conferem." };
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password))
    return { error: "Use 12+ caracteres com maiúscula, minúscula, número e símbolo." };
  const db = await createClient();
  const { data: u } = await db.auth.getUser();
  const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!u.user || aal?.currentLevel !== "aal2") redirect("/login");
  const { error } = await db.auth.updateUser({ password });
  if (error) return { error: message(error) };
  const { error: e2 } = await adminClient().schema("os").rpc("admin_password_changed", { p_user_id: u.user.id });
  if (e2) return { error: message(e2) };
  redirect("/builder");
}

export async function signOut() {
  const db = await createClient();
  await db.auth.signOut({ scope: "local" });
  redirect("/login");
}
