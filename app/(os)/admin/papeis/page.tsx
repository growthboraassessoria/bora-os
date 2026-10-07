import { Fragment } from "react";
import { requirePerm } from "@/lib/auth";
import { MODULE_LABEL } from "@/lib/perms";
import { PageHead, Panel, Chip, th, td } from "@/components/ui";
import { PermToggle, NewRole, DeleteRole } from "./forms";

export const metadata = { title: "Papéis e permissões" };

export default async function Papeis() {
  const a = await requirePerm("admin.roles.manage");
  const os = a.db.schema("os");
  const [{ data: roles }, { data: perms }, { data: rp }, { data: mr }] = await Promise.all([
    os.from("roles").select("id,slug,name,description,is_system").order("is_system", { ascending: false }).order("name"),
    os.from("permissions").select("key,module,label,description,sensitive").order("sort"),
    os.from("role_permissions").select("role_id,permission_key"),
    os.from("member_roles").select("role_id"),
  ]);
  const has = new Set((rp ?? []).map((x) => `${x.role_id}:${x.permission_key}`));
  const count = (id: string) => (mr ?? []).filter((x) => x.role_id === id).length;
  const modules = [...new Set((perms ?? []).map((p) => p.module))];

  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="Admin · Papéis" title="Papéis e permissões" desc="Cada papel é um conjunto de permissões. Crie papéis seus e marque o que cada um pode. O Proprietário tem tudo e não muda. Alterar permissão pede o código do autenticador." />
      <div className="grid gap-4 2xl:grid-cols-4">
        <Panel pad={false} className="2xl:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="sticky top-0 bg-surface">
                <tr>
                  <th className={`${th} w-[34%]`}>Permissão</th>
                  {(roles ?? []).map((r) => (
                    <th key={r.id} className={`${th} text-center`}>
                      <span className="block normal-case tracking-normal text-fg" style={{ fontFamily: "var(--font-sans)", fontSize: 12 }}>{r.name}</span>
                      <span className="block">{count(r.id)} membros</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((mod) => (
                  <Fragment key={mod}>
                    <tr><td colSpan={(roles ?? []).length + 1} className="eyebrow border-b border-line bg-surface-2 px-3 py-1.5">{MODULE_LABEL[mod] ?? mod}</td></tr>
                    {(perms ?? []).filter((p) => p.module === mod).map((p) => (
                      <tr key={p.key} className="hover:bg-surface-2">
                        <td className={`${td} whitespace-normal py-1.5`}>
                          <span className="text-fg">{p.label}</span> {p.sensitive && <Chip tone="warning">sensível</Chip>}
                          <span className="block text-[11.5px] text-fg-3">{p.description}</span>
                        </td>
                        {(roles ?? []).map((r) => (
                          <td key={r.id} className={`${td} text-center`}>
                            <PermToggle roleId={r.id} perm={p.key} on={has.has(`${r.id}:${p.key}`)} locked={r.slug === "owner"} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="space-y-4">
          <NewRole roles={(roles ?? []).map((r) => ({ id: r.id, name: r.name }))} />
          <Panel eyebrow="Papéis personalizados" title="Apagar papel" pad={false}>
            <ul>
              {(roles ?? []).filter((r) => !r.is_system).map((r) => (
                <li key={r.id} className="flex items-center justify-between border-b border-line px-4 py-2 last:border-0">
                  <span>{r.name} <span className="text-fg-3">· {count(r.id)} membros</span></span><DeleteRole id={r.id} name={r.name} />
                </li>
              ))}
              {!(roles ?? []).some((r) => !r.is_system) && <li className="px-4 py-3 text-fg-3">Nenhum papel personalizado.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
