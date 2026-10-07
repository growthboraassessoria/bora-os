import { requireSession } from "@/lib/auth";
import { dateTime, ago } from "@/lib/format";
import { PageHead, Panel, Chip, Empty, th, td } from "@/components/ui";
import { NewConnection, RevokeButton } from "./forms";

export const metadata = { title: "Conexões MCP" };

type Conn = { id: string; name: string; token_prefix: string; created_by: string; permissions: string[]; tools: string[] | null; ip_allowlist: string[] | null; expires_at: string; last_used_at: string | null; revoked_at: string | null; created_at: string };

export default async function Conexoes() {
  const a = await requireSession();
  const manage = a.perms.has("mcp.connections.manage");
  const [{ data: conns }, { data: perms }, { data: tools }] = await Promise.all([
    a.db.schema("mcp").from("connections").select("id,name,token_prefix,created_by,permissions,tools,ip_allowlist,expires_at,last_used_at,revoked_at,created_at").order("created_at", { ascending: false }),
    a.db.schema("os").from("permissions").select("key,label,module,sensitive").order("sort"),
    a.db.schema("mcp").from("tools").select("name,description,required_perm,write,enabled").order("sort"),
  ]);
  const usable = (perms ?? []).filter((p) => p.module === "builder" && a.perms.has(p.key));
  const now = Date.now();
  const status = (c: Conn) => (c.revoked_at ? "revogada" : new Date(c.expires_at).getTime() < now ? "vencida" : "ativa");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://os.boraassessoria.com";

  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="MCP · Conexões" title="Conexões externas" desc="O BORA OS é um servidor MCP. Cada sistema conectado (Claude, automações, CRM) recebe uma chave própria, com permissões que nunca passam as de quem criou. Toda chamada fica registrada." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel eyebrow={`${(conns ?? []).length} chaves`} title="Chaves" pad={false} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr><th className={th}>Nome</th><th className={th}>Chave</th><th className={th}>Permissões</th><th className={th}>Status</th><th className={th}>Último uso</th><th className={th}>Vence</th><th className={th} /></tr></thead>
              <tbody>
                {((conns ?? []) as Conn[]).map((c) => {
                  const s = status(c);
                  return (
                    <tr key={c.id} className="hover:bg-surface-2">
                      <td className={td}>{c.name}</td>
                      <td className={`${td} mono text-fg-3`}>{c.token_prefix}…</td>
                      <td className={td}><span className="text-fg-2">{c.permissions.length}</span>{c.permissions.includes("builder.leads.pii") && <Chip tone="warning" className="ml-1.5">dados pessoais</Chip>}</td>
                      <td className={td}><Chip tone={s === "ativa" ? "signal" : s === "revogada" ? "danger" : "outline"}>{s}</Chip></td>
                      <td className={`${td} text-fg-2`}>{c.last_used_at ? ago(c.last_used_at) : "nunca"}</td>
                      <td className={`${td} mono text-[12px] text-fg-3`}>{dateTime(c.expires_at)}</td>
                      <td className={`${td} text-right`}>{s === "ativa" && (manage || c.created_by === a.member.user_id) && <RevokeButton id={c.id} name={c.name} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!(conns ?? []).length && <Empty title="Nenhuma conexão criada." />}
        </Panel>
        <div className="space-y-4">
          {manage ? <NewConnection perms={usable} tools={(tools ?? []).filter((t) => t.enabled)} /> : <Panel title="Sem permissão para criar chaves"><p className="text-fg-3">Peça a um admin.</p></Panel>}
          <Panel eyebrow="Como conectar" title="Claude Code e outros clientes">
            <p className="mb-2 text-fg-2">Endereço do servidor:</p>
            <code className="mono block break-all rounded-sm bg-bg px-2 py-1.5 text-[12px]">{site}/api/mcp</code>
            <p className="mb-2 mt-3 text-fg-2">No Claude Code:</p>
            <code className="mono block break-all rounded-sm bg-bg px-2 py-1.5 text-[11.5px] text-fg-2">claude mcp add --transport http bora-os {site}/api/mcp --header &quot;Authorization: Bearer bos_…&quot;</code>
            <p className="mt-3 text-fg-3">A chave aparece uma vez só, na criação. Guarde num cofre de senhas. Perdeu? Revogue e crie outra.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
