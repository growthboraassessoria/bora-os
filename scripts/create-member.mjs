// Cria (ou atualiza) um membro do BORA OS com senha provisória. Uso no terminal, com a chave de serviço do ambiente:
//   node --env-file=.env.local scripts/create-member.mjs email@dominio "Nome Completo" owner [UF,UF]
// Papéis: owner, admin, growth, comercial, leitura. A senha provisória aparece uma vez; no primeiro acesso a pessoa troca e ativa o autenticador.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const [email, name, role = "leitura", ufs] = process.argv.slice(2);
if (!email || !name) {
  console.error('uso: node --env-file=.env.local scripts/create-member.mjs email "Nome" papel [UF,UF]');
  process.exit(1);
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

export function tempPassword() {
  const b = randomBytes(18).toString("base64url");
  return `Bora-${b.slice(0, 6)}!${b.slice(6, 12)}#${b.slice(12, 16)}9a`;
}

const password = process.env.MEMBER_PASSWORD || tempPassword();
const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
let user = list.users.find((u) => u.email === email.toLowerCase());
if (!user) {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  user = data.user;
} else {
  const { error } = await db.auth.admin.updateUserById(user.id, { password });
  if (error) throw error;
}
const { error } = await db.schema("os").rpc("admin_upsert_member", {
  p_actor: null, p_user_id: user.id, p_email: email, p_full_name: name, p_role_slugs: [role],
  p_ufs: ufs ? ufs.split(",").map((u) => u.trim().toUpperCase()) : null, p_must_change: !process.env.MEMBER_PASSWORD,
});
if (error) throw error;
console.log(JSON.stringify({ email, role, user_id: user.id, ...(process.env.MEMBER_PASSWORD ? {} : { senha_provisoria: password }) }));
