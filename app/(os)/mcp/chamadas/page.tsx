import { requirePerm } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { PageHead, Panel, Chip, Empty, th, td } from "@/components/ui";

export const metadata = { title: "Chamadas MCP" };

export default async function Chamadas() {
  const a = await requirePerm("mcp.calls.read");
  const [{ data: calls }, { data: conns }] = await Promise.all([
    a.db.schema("mcp").from("calls").select("id,connection_id,tool,args,status,error,rows,duration_ms,ip,at").order("at", { ascending: false }).limit(300),
    a.db.schema("mcp").from("connections").select("id,name"),
  ]);
  const name = new Map((conns ?? []).map((c) => [c.id, c.name]));
  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="MCP · Chamadas" title="Registro de chamadas" desc="As últimas 300 chamadas, com argumentos (dado pessoal mascarado), resultado, linhas devolvidas e tempo." />
      <Panel pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr><th className={th}>Quando</th><th className={th}>Conexão</th><th className={th}>Ferramenta</th><th className={th}>Argumentos</th><th className={th}>Resultado</th><th className={`${th} text-right`}>Linhas</th><th className={`${th} text-right`}>ms</th><th className={th}>IP</th></tr></thead>
            <tbody>
              {(calls ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-surface-2">
                  <td className={`${td} mono text-[12px] text-fg-3`}>{dateTime(c.at)}</td>
                  <td className={td}>{c.connection_id ? name.get(c.connection_id) ?? "—" : <span className="text-fg-3">chave inválida</span>}</td>
                  <td className={`${td} mono`}>{c.tool}</td>
                  <td className={`${td} mono max-w-[280px] truncate text-[11.5px] text-fg-3`}>{JSON.stringify(c.args)}</td>
                  <td className={td}>{c.status === "ok" ? <Chip>ok</Chip> : <Chip tone={c.status === "denied" ? "warning" : "danger"}>{c.status === "denied" ? "negada" : "erro"}</Chip>} {c.error && <span className="text-[11.5px] text-fg-3">{c.error}</span>}</td>
                  <td className={`${td} num text-right`}>{c.rows ?? "—"}</td>
                  <td className={`${td} num text-right text-fg-3`}>{c.duration_ms ?? "—"}</td>
                  <td className={`${td} mono text-[11.5px] text-fg-3`}>{c.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!(calls ?? []).length && <Empty title="Nenhuma chamada ainda." />}
      </Panel>
    </div>
  );
}
