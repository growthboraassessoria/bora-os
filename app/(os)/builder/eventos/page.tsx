import { requirePerm } from "@/lib/auth";
import { rpc, SITE_ID } from "@/lib/builder";
import { PageHead } from "@/components/ui";
import { LiveFeed, type Ev } from "./LiveFeed";

export const metadata = { title: "Ao vivo" };

export default async function AoVivo() {
  const a = await requirePerm("builder.analytics.read");
  const events = await rpc<Ev[]>(a.db, "recent_events", { f: { site_id: SITE_ID, limit: 150 } });
  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="Builder · Ao vivo" title="O que está acontecendo na LP" desc="Eventos chegando, sem dado pessoal. Atualiza a cada 10 segundos." />
      <LiveFeed initial={events} />
    </div>
  );
}
