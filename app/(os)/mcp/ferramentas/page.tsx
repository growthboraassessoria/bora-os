import { requireSession } from "@/lib/auth";
import { PageHead, Panel, Chip, th, td } from "@/components/ui";
import { ToolToggle } from "../forms";

export const metadata = { title: "Ferramentas MCP" };

export default async function Ferramentas() {
  const a = await requireSession();
  const [{ data: tools }, { data: perms }] = await Promise.all([
    a.db.schema("mcp").from("tools").select("name,description,required_perm,write,enabled").order("sort"),
    a.db.schema("os").from("permissions").select("key,label"),
  ]);
  const label = new Map((perms ?? []).map((p) => [p.key, p.label]));
  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="MCP · Ferramentas" title="O que um sistema conectado pode fazer" desc="Ferramenta desligada some para todas as chaves. As de escrita começam desligadas: ligue só quando houver um uso combinado." />
      <Panel pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr><th className={th}>Ferramenta</th><th className={th}>O que faz</th><th className={th}>Exige</th><th className={th}>Tipo</th><th className={th}>Estado</th></tr></thead>
            <tbody>
              {(tools ?? []).map((t) => (
                <tr key={t.name} className="hover:bg-surface-2">
                  <td className={`${td} mono`}>{t.name}</td>
                  <td className={`${td} whitespace-normal text-fg-2`}>{t.description}</td>
                  <td className={`${td} text-fg-2`}>{label.get(t.required_perm) ?? t.required_perm}</td>
                  <td className={td}>{t.write ? <Chip tone="warning">escrita</Chip> : <Chip>leitura</Chip>}</td>
                  <td className={td}><ToolToggle name={t.name} enabled={t.enabled} canEdit={a.perms.has("mcp.connections.manage")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
