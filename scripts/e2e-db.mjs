// Testes de segurança contra a homologação: login, segundo fator, permissões, escopo, dado pessoal, auditoria e MCP.
// Uso: node --env-file=.env.local scripts/e2e-db.mjs   (cria membros de teste @teste.bora.invalid)
import { createClient } from "@supabase/supabase-js";
import { TOTP, Secret } from "otpauth";
import postgres from "postgres";
import { createHash, randomBytes } from "node:crypto";

const URL_ = process.env.SUPABASE_URL, ANON = process.env.SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_?.includes("meqxnkwduluiozxlodfr")) throw new Error("e2e só roda na homologação");
const admin = createClient(URL_, SVC, { auth: { persistSession: false } });
let pass = 0, failn = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log("  ✓", label); } else { failn++; console.log("  ✗", label); } };

async function member(email, role, ufs = null) {
  const password = "Teste-" + randomBytes(8).toString("hex") + "!A1";
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let u = list.users.find((x) => x.email === email);
  if (u) {
    const d = await admin.auth.admin.deleteUser(u.id);
    if (d.error) throw new Error(`apagar ${email}: ${d.error.message}`);
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  u = data.user;
  const r = await admin.schema("os").rpc("admin_upsert_member", { p_actor: null, p_user_id: u.id, p_email: email, p_full_name: role + " teste", p_role_slugs: [role], p_ufs: ufs, p_must_change: false });
  if (r.error) throw r.error;
  return { id: u.id, email, password };
}

async function login(m, { mfa = true } = {}) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email: m.email, password: m.password });
  if (s.error) throw s.error;
  if (!mfa) return c;
  if (!m.secret) {
    const e = await c.auth.mfa.enroll({ factorType: "totp", issuer: "BORA OS" });
    if (e.error) throw e.error;
    m.secret = e.data.totp.secret; m.factor = e.data.id;
  }
  const code = new TOTP({ secret: Secret.fromBase32(m.secret) }).generate();
  const v = await c.auth.mfa.challengeAndVerify({ factorId: m.factor, code });
  if (v.error) throw v.error;
  return c;
}

async function cleanup() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const mine = data.users.filter((u) => u.email?.endsWith("@teste.bora.invalid")).sort((a, b) => (a.email.startsWith("owner") ? 1 : 0) - (b.email.startsWith("owner") ? 1 : 0));
  for (const u of mine) {
    const d = await admin.auth.admin.deleteUser(u.id);
    if (d.error) throw new Error(`apagar ${u.email}: ${d.error.message}`);
  }
}
await cleanup();
console.log("Membros de teste");
const owner = await member("owner@teste.bora.invalid", "owner");
const leitura = await member("leitura@teste.bora.invalid", "leitura");
const comercialGO = await member("comercial-go@teste.bora.invalid", "comercial", ["GO"]);

console.log("Segundo fator");
const ownerAal1 = await login(owner, { mfa: false });
let r = await ownerAal1.schema("builder").rpc("search_leads", { f: { limit: 5 } });
ok(!!r.error, "sem autenticador (aal1): busca de cadastros recusada");
r = await ownerAal1.schema("os").from("members").select("*");
ok((r.data ?? []).length === 0, "sem autenticador: nem o próprio registro aparece");
const ow = await login(owner);
r = await ow.schema("builder").rpc("search_leads", { f: { limit: 5 } });
ok(!r.error && r.data.total > 0, `com autenticador (aal2): ${r.data?.total} cadastros`);
ok(r.data?.can_reveal === true && r.data.rows[0].email.includes("•"), "lista mascarada até para o proprietário (revela na ficha)");

console.log("Acesso direto às tabelas");
r = await ow.from("leads").select("email").limit(1);
ok(!!r.error || (r.data ?? []).length === 0, "tabela leads não se lê direto, nem pelo proprietário");
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
r = await anon.from("leads").select("id").limit(1);
ok(!!r.error || (r.data ?? []).length === 0, "anônimo não lê leads");
r = await anon.schema("builder").rpc("search_leads", { f: {} });
ok(!!r.error, "anônimo não executa funções do builder");
r = await anon.from("city_stats").select("*").limit(1);
ok(!!r.error || (r.data ?? []).length === 0, "anônimo não lê views agregadas");

console.log("Papel Leitura");
const le = await login(leitura);
r = await le.schema("builder").rpc("search_leads", { f: { limit: 3 } });
ok(!r.error && r.data.pii === false && r.data.rows[0].email.includes("•"), "leitura vê contato mascarado");
r = await le.schema("builder").rpc("search_leads", { f: { q: "@exemplo.com.br" } });
ok(!!r.error, "leitura não busca por e-mail");
const someId = (await ow.schema("builder").rpc("search_leads", { f: { limit: 1 } })).data.rows[0].id;
r = await le.schema("builder").rpc("get_lead", { p_id: someId, p_reveal: true });
ok(!!r.error, "leitura não revela dado pessoal");
r = await le.schema("builder").rpc("update_lead", { p_id: someId, p: { first_name: "X" } });
ok(!!r.error, "leitura não edita");
r = await le.schema("builder").rpc("export_leads", { f: {} });
ok(!!r.error, "leitura não exporta");
r = await le.schema("os").from("audit_log").select("id").limit(1);
ok((r.data ?? []).length === 0, "leitura não vê auditoria");
r = await le.schema("os").from("role_permissions").insert({ role_id: (await le.schema("os").from("roles").select("id").eq("slug", "leitura").single()).data.id, permission_key: "builder.leads.pii" });
ok(!!r.error, "leitura não se dá permissão");

console.log("Escopo de UF");
const co = await login(comercialGO);
r = await co.schema("builder").rpc("search_leads", { f: { limit: 500 } });
ok(!r.error && r.data.total > 0 && r.data.rows.every((x) => x.state === "GO"), `comercial GO só vê GO (${r.data?.total})`);
const outside = (await ow.schema("builder").rpc("search_leads", { f: { uf: "PE", limit: 1 } })).data.rows[0].id;
r = await co.schema("builder").rpc("get_lead", { p_id: outside });
ok(!r.error && r.data === null, "comercial GO não abre cadastro de PE");
r = await co.schema("builder").rpc("dashboard", { f: {} });
ok(!r.error && r.data.events_visible === false, "comercial GO não vê métricas de visita sem UF");

console.log("Revelação, edição e auditoria");
r = await ow.schema("builder").rpc("get_lead", { p_id: someId, p_reveal: true });
ok(!r.error && !r.data.email.includes("•"), "proprietário revela contato");
r = await ow.schema("builder").rpc("update_lead", { p_id: someId, p: { first_name: "Editado" } });
ok(!r.error, "proprietário edita");
r = await ow.schema("os").from("audit_log").select("action,actor_type,actor_id,entity,after").eq("entity_id", someId).order("at", { ascending: false }).limit(5);
ok(r.data?.some((x) => x.action === "update" && x.actor_id === owner.id && x.after?.first_name === "Editado"), "edição registrada com o autor");
ok(r.data?.some((x) => x.action === "pii.revealed"), "revelação registrada");
const del = await ow.schema("os").from("audit_log").delete().eq("entity_id", someId);
const still = await ow.schema("os").from("audit_log").select("id").eq("entity_id", someId);
ok((still.data ?? []).length >= 2, "auditoria não se apaga");
await ow.schema("builder").rpc("update_lead", { p_id: someId, p: { first_name: "Ana" } });

console.log("Criação e duplicidade");
r = await ow.schema("builder").rpc("create_lead", { p: { first_name: "Teste", last_name: "E2E", email: "e2e@teste.bora.invalid", phone: "62999990000", cep: "74000000", state: "GO", city_slug: "go-goiania" } });
ok(!r.error && r.data.created, "cria cadastro pelo OS");
const dup = await ow.schema("builder").rpc("create_lead", { p: { first_name: "Outro", last_name: "Nome", email: "E2E@teste.bora.invalid", phone: "62988887777", cep: "74000000", state: "GO", city_slug: "go-goiania" } });
ok(!dup.error && dup.data.created === false, "duplicado por e-mail não entra");
r = await co.schema("builder").rpc("create_lead", { p: { first_name: "Fora", last_name: "Escopo", email: "fora@teste.bora.invalid", phone: "81999990000", cep: "50000000", state: "PE", city_slug: "pe-recife" } });
ok(!!r.error, "comercial GO não cria cadastro em PE");

console.log("Papéis");
r = await ow.schema("os").from("member_roles").delete().eq("user_id", owner.id);
ok(!!r.error || (await ow.schema("os").from("member_roles").select("role_id").eq("user_id", owner.id)).data.length > 0, "ninguém tira o próprio papel");
const ownerRole = (await ow.schema("os").from("roles").select("id").eq("slug", "owner").single()).data.id;
r = await ow.schema("os").from("role_permissions").delete().eq("role_id", ownerRole).eq("permission_key", "builder.leads.read");
ok(!!r.error, "permissões do Proprietário são fixas");

console.log("Sessão encerrada perde acesso");
const ow2 = await login(owner);
const { data: sess } = await ow.schema("os").rpc("member_sessions", { p_user_id: owner.id });
ok((sess ?? []).length >= 2, `sessões listadas (${sess?.length})`);
await ow.schema("os").rpc("end_sessions", { p_user_id: owner.id });
r = await ow2.schema("builder").rpc("search_leads", { f: { limit: 1 } });
ok(!!r.error, "token de sessão encerrada é recusado pelo banco");

console.log("MCP");
const token = "bos_" + randomBytes(24).toString("base64url");
const hash = createHash("sha256").update(token).digest("hex");
r = await ow.schema("mcp").rpc("create_connection", { p_name: "e2e", p_prefix: token.slice(0, 10), p_hash: hash, p_permissions: ["builder.dashboard.read", "builder.leads.read"], p_tools: null, p_days: 1, p_ips: null });
ok(!r.error, "proprietário cria conexão");
const leRole = await le.schema("mcp").rpc("create_connection", { p_name: "x", p_prefix: "x", p_hash: "x" + hash, p_permissions: ["builder.leads.pii"], p_tools: null, p_days: 1, p_ips: null });
ok(!!leRole.error, "leitura não cria conexão");
const sql = postgres(process.env.MCP_DATABASE_URL, { prepare: false, max: 1 });
try {
  const [{ describe: d }] = await sql`select mcp.describe(${hash}, ${"127.0.0.1"}) as describe`;
  ok(d && d.tools.length >= 2 && !d.tools.some((t) => t.name === "origem_cadastros"), `gateway lista só as ferramentas liberadas (${d?.tools.map((t) => t.name).join(", ")})`);
  const [{ call: c1 }] = await sql`select mcp.call(${hash}, 'buscar_cadastros', ${sql.json({ limite: 2 })}, ${"127.0.0.1"}) as call`;
  ok(c1?.rows?.length === 2 && c1.rows[0].email.includes("•"), "gateway busca com contato mascarado");
  const [{ call: c2 }] = await sql`select mcp.call(${hash}, 'origem_cadastros', ${sql.json({})}, ${"127.0.0.1"}) as call`;
  ok(c2?.error === "ferramenta_nao_liberada", "ferramenta fora da permissão é negada");
  const [{ call: c3 }] = await sql`select mcp.call(${"errado"}, 'buscar_cadastros', ${sql.json({})}, ${"127.0.0.1"}) as call`;
  ok(c3?.error === "chave_invalida", "chave errada é negada");
  let direct;
  try { await sql`select count(*) from public.leads`; direct = true; } catch { direct = false; }
  ok(direct === false, "papel do gateway não lê tabelas");
} finally { await sql.end(); }

console.log(`\n${pass} ok · ${failn} falhas`);
await admin.from("leads").delete().eq("email", "e2e@teste.bora.invalid");
await cleanup();
process.exit(failn ? 1 : 0);
