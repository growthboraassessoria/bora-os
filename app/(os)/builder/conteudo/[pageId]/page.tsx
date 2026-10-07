import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { SEO_DEFAULTS, contentFieldsFor } from "@/lib/contentSchema";
import { Editor, type Version } from "./Editor";

export const metadata = { title: "Editar página" };

export default async function EditPage({ params }: { params: Promise<{ pageId: string }> }) {
  const a = await requirePerm("builder.sites.read");
  const { pageId } = await params;
  const { data: page } = await a.db.schema("builder").from("pages").select("id,route,name,site_id,sites(name,production_url)").eq("id", pageId).maybeSingle();
  if (!page) notFound();
  const { data: versions } = await a.db.schema("builder").from("page_versions").select("id,version,status,seo,content,note,created_at,published_at").eq("page_id", pageId).order("version", { ascending: false });
  const site = page.sites as unknown as { name: string; production_url: string };
  return (
    <Editor
      page={{ id: page.id, route: page.route, name: page.name, url: site.production_url + (page.route.includes("[") ? "" : page.route) }}
      versions={(versions ?? []) as Version[]}
      seoDefaults={SEO_DEFAULTS[page.route] ?? {}}
      contentFields={contentFieldsFor(page.route)}
      canEdit={a.perms.has("builder.sites.edit")}
      canPublish={a.perms.has("builder.sites.publish")}
    />
  );
}
