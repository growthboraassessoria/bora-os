import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { SITE_ID } from "@/lib/builder";
import { dateTime } from "@/lib/format";
import { PageHead, Panel, Chip, th, td, KV } from "@/components/ui";

export const metadata = { title: "Conteúdo e SEO" };

type Page = { id: string; route: string; name: string; sort: number; page_versions: { id: string; version: number; status: string; created_at: string; published_at: string | null }[] };

export default async function Conteudo() {
  const a = await requirePerm("builder.sites.read");
  const [{ data: site }, { data: pages }] = await Promise.all([
    a.db.schema("builder").from("sites").select("*").eq("id", SITE_ID).single(),
    a.db.schema("builder").from("pages").select("id,route,name,sort,page_versions(id,version,status,created_at,published_at)").eq("site_id", SITE_ID).order("sort"),
  ]);

  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="Builder · Conteúdo e SEO" title={site?.name ?? "Site"} desc="Título, descrição, imagem de compartilhamento e os textos principais de cada página. Rascunho, publicação e volta de versão, sem novo deploy." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel eyebrow="Páginas" title="Escolha uma página" pad={false} className="xl:col-span-2">
          <table className="w-full">
            <thead><tr><th className={th}>Página</th><th className={th}>Rota</th><th className={th}>No ar</th><th className={th}>Rascunho</th><th className={`${th} text-right`}>Atualizado</th></tr></thead>
            <tbody>
              {((pages ?? []) as Page[]).map((p) => {
                const pub = p.page_versions.find((v) => v.status === "published");
                const draft = p.page_versions.find((v) => v.status === "draft");
                const last = [...p.page_versions].sort((x, y) => y.version - x.version)[0];
                return (
                  <tr key={p.id} className="relative hover:bg-surface-2">
                    <td className={td}><Link href={`/builder/conteudo/${p.id}`} className="after:absolute after:inset-0">{p.name}</Link></td>
                    <td className={`${td} mono text-fg-3`}>{p.route}</td>
                    <td className={td}>{pub ? <Chip tone="signal">v{pub.version}</Chip> : <Chip tone="outline">padrão da LP</Chip>}</td>
                    <td className={td}>{draft ? <Chip tone="warning">v{draft.version} em edição</Chip> : <span className="text-fg-3">—</span>}</td>
                    <td className={`${td} mono text-right text-fg-3`}>{last ? dateTime(last.published_at ?? last.created_at) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
        <Panel eyebrow="Site" title="Conexão com a LP">
          <KV k="Endereço" v={<a href={site?.production_url} target="_blank" rel="noreferrer" className="hover:underline">{site?.domain}</a>} />
          <KV k="Revalidação" v={<span className="mono text-[11.5px]">{site?.revalidate_url?.replace(/^https?:\/\//, "") ?? "—"}</span>} />
          <KV k="Status" v={site?.status} />
          <p className="mt-3 text-fg-3">Ao publicar, o OS avisa a LP por uma chamada assinada. A LP precisa ter a rota <span className="mono">/api/revalidate</span> e ler o conteúdo publicado: é o contrato do Builder, descrito na arquitetura.</p>
        </Panel>
      </div>
    </div>
  );
}
