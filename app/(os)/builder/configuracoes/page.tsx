import { requirePerm } from "@/lib/auth";
import { SITE_ID } from "@/lib/builder";
import { PageHead } from "@/components/ui";
import { SettingsForm, Testimonials, type Settings } from "./forms";

export const metadata = { title: "Configurações" };

export default async function Configuracoes() {
  const a = await requirePerm("builder.sites.read");
  const [{ data: s }, { data: site }, { data: t }] = await Promise.all([
    a.db.schema("builder").from("site_settings").select("settings,updated_at").eq("site_id", SITE_ID).maybeSingle(),
    a.db.schema("builder").from("sites").select("id,name,domain,production_url,revalidate_url,status").eq("id", SITE_ID).single(),
    a.db.from("testimonials").select("id,name,city,text,approved,created_at").order("created_at", { ascending: false }),
  ]);
  const canEdit = a.perms.has("builder.sites.edit");
  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="Builder · Configurações" title="Configurações do site" desc="O que hoje está fixo no código ou nas variáveis da LP passa a ser editado aqui. A LP lê na próxima publicação." />
      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsForm settings={(s?.settings ?? {}) as Settings} site={site!} canEdit={canEdit} canPublish={a.perms.has("builder.sites.publish")} />
        <Testimonials items={t ?? []} canEdit={canEdit} />
      </div>
    </div>
  );
}
