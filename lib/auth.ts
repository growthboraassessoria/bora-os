// Quem está logado, em que nível (senha ou senha + autenticador) e com quais permissões.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, type Db } from "./supabase/server";
import type { Perm } from "./perms";

export const STEP_UP_SECONDS = 10 * 60;

export type Member = {
  user_id: string;
  email: string;
  full_name: string;
  status: "active" | "suspended";
  must_change_password: boolean;
};

export type AuthState =
  | { stage: "anon" }
  | { stage: "no-member"; db: Db }
  | { stage: "enroll" | "verify"; db: Db; member: Member }
  | { stage: "password"; db: Db; member: Member }
  | { stage: "ok"; db: Db; member: Member; perms: Set<string>; roles: string[]; ufs: string[] | null; totpAt: number | null };

/** Estado da sessão, uma vez por requisição. */
export const getAuth = cache(async (): Promise<AuthState> => {
  const db = await createClient();
  const { data: u } = await db.auth.getUser();
  if (!u.user) return { stage: "anon" };

  const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: m } = await db.schema("os").from("members").select("user_id,email,full_name,status,must_change_password").eq("user_id", u.user.id).maybeSingle<Member>();

  if (aal?.currentLevel !== "aal2") {
    // Antes do segundo fator o RLS não libera nem o próprio registro; o status vem do Auth.
    const member: Member = m ?? { user_id: u.user.id, email: u.user.email ?? "", full_name: (u.user.user_metadata?.full_name as string) ?? "", status: "active", must_change_password: false };
    const hasTotp = (u.user.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified");
    return { stage: hasTotp ? "verify" : "enroll", db, member };
  }
  if (!m || m.status !== "active") return { stage: "no-member", db };
  if (m.must_change_password) return { stage: "password", db, member: m };

  const [{ data: perms }, { data: roles }, { data: scope }] = await Promise.all([
    db.schema("os").rpc("my_permissions"),
    db.schema("os").from("member_roles").select("roles(name)").eq("user_id", m.user_id),
    db.schema("os").from("member_scopes").select("ufs").eq("user_id", m.user_id).maybeSingle<{ ufs: string[] | null }>(),
  ]);
  const methods = (aal.currentAuthenticationMethods ?? []) as { method: string; timestamp: number }[];
  const totp = methods.filter((x) => typeof x === "object" && x.method === "totp").map((x) => x.timestamp);
  return {
    stage: "ok",
    db,
    member: m,
    perms: new Set((perms as string[] | null) ?? []),
    roles: ((roles ?? []) as unknown as { roles: { name: string } | null }[]).map((r) => r.roles?.name ?? "").filter(Boolean),
    ufs: scope?.ufs ?? null,
    totpAt: totp.length ? Math.max(...totp) : null,
  };
});

/** Para páginas: manda cada um para a etapa certa do login. */
export async function requireSession() {
  const a = await getAuth();
  if (a.stage === "anon" || a.stage === "no-member") redirect("/login");
  if (a.stage === "enroll") redirect("/login/autenticador");
  if (a.stage === "verify") redirect("/login/codigo");
  if (a.stage === "password") redirect("/login/nova-senha");
  if (a.stage !== "ok") redirect("/login");
  return a;
}

export async function requirePerm(p: Perm) {
  const a = await requireSession();
  if (!a.perms.has(p)) redirect("/sem-acesso");
  return a;
}

export class StepUpRequired extends Error {
  constructor() {
    super("confirmacao_necessaria");
  }
}

/** Para ações sensíveis: código do autenticador nos últimos 10 minutos. */
export async function assertStepUp() {
  const a = await getAuth();
  if (a.stage !== "ok") throw new Error("sessao_invalida");
  const now = Math.floor(Date.now() / 1000);
  if (!a.totpAt || now - a.totpAt > STEP_UP_SECONDS) throw new StepUpRequired();
  return a;
}

/** Para server actions: sessão completa e permissão, sem redirecionar. */
export async function actionAuth(p?: Perm) {
  const a = await getAuth();
  if (a.stage !== "ok") throw new Error("sessao_invalida");
  if (p && !a.perms.has(p)) throw new Error("sem_permissao");
  return a;
}
