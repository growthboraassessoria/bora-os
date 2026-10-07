import { requirePerm } from "@/lib/auth";
import { rpc, SITE_ID } from "@/lib/builder";
import { num } from "@/lib/format";
import { PageHead, Panel, Bar, Chip, Empty, th, td } from "@/components/ui";
import { UfPicker } from "@/components/builder/Filters";
import { WhatsappLinks } from "./WhatsappLinks";

export const metadata = { title: "Cidades" };
type City = { slug: string; name: string; uf: string; approx: boolean; leads: number; founders: number; last7: number; pct: number; slots_left: number };
type State = { uf: string; name: string; whatsapp_url: string | null; leads: number };

export default async function Cidades({ searchParams }: { searchParams: Promise<{ uf?: string }> }) {
  const a = await requirePerm("builder.dashboard.read");
  const sp = await searchParams;
  const d = await rpc<{ rows: City[]; goal: number; slots: number; states: State[] }>(a.db, "cities", { f: { uf: sp.uf || null, site_id: SITE_ID } });
  const states = d.states.filter((s) => s.leads > 0 || s.whatsapp_url);

  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="Builder · Cidades" title="Ranking de cidades" desc={`Meta de ${num(d.goal)} pessoas por cidade e ${d.slots} vagas de Fundador. Os dois números mudam em Configurações.`} right={<UfPicker value={sp.uf} allowed={a.ufs} />} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Ranking" title={`${d.rows.length} cidades com cadastro`} pad={false} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr>
                <th className={th}>#</th><th className={th}>Cidade</th><th className={`${th} w-[34%]`}>Meta</th>
                <th className={`${th} text-right`}>Pessoas</th><th className={`${th} text-right`}>7 dias</th><th className={`${th} text-right`}>Fundadores</th><th className={`${th} text-right`}>Vagas</th>
              </tr></thead>
              <tbody>
                {d.rows.map((c, i) => (
                  <tr key={c.slug} className="hover:bg-surface-2">
                    <td className={`${td} num text-fg-3`}>{i + 1}</td>
                    <td className={td}>{c.name} <span className="text-fg-3">{c.uf}</span> {c.approx && <Chip tone="outline" className="ml-1">local aprox.</Chip>}</td>
                    <td className={td}><div className="flex items-center gap-2"><Bar value={c.pct} max={100} /><span className="num w-10 text-right text-fg-3">{c.pct}%</span></div></td>
                    <td className={`${td} num text-right text-fg`}>{num(c.leads)}</td>
                    <td className={`${td} num text-right text-fg-2`}>{c.last7 ? `+${num(c.last7)}` : "—"}</td>
                    <td className={`${td} num text-right`}>{num(c.founders)}</td>
                    <td className={`${td} num text-right text-fg-3`}>{num(c.slots_left)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!d.rows.length && <Empty title="Nenhuma cidade com cadastro." />}
        </Panel>
        <Panel eyebrow="Comunidades" title="Grupos de WhatsApp por estado">
          <p className="mb-3 text-fg-3">A LP mostra o link do grupo do estado na página de obrigado. Sem link, o bloco fica oculto.</p>
          <WhatsappLinks states={states} canEdit={a.perms.has("builder.sites.edit")} />
        </Panel>
      </div>
    </div>
  );
}
