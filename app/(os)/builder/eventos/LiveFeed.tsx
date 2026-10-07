"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { EVENT_LABEL } from "@/lib/eventLabels";
import { boraId, time, date } from "@/lib/format";
import { Panel, Chip, Empty, cx } from "@/components/ui";
import { pollEvents } from "./actions";

export type Ev = { id: string; name: string; at: string; path: string | null; source: string | null; props: Record<string, unknown>; lead: { id: string; bora_number: number; name: string; city: string; state: string } | null };

const KEY = new Set(["form_completed", "referred_signup", "share_whatsapp", "share_instagram", "share_copy", "qualification_completed", "founder_view"]);

export function LiveFeed({ initial }: { initial: Ev[] }) {
  const [events, setEvents] = useState(initial);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [onlyKey, setOnlyKey] = useState(false);

  useEffect(() => {
    const t = setInterval(async () => {
      const after = events[0]?.at;
      const r = await pollEvents(after ?? null);
      if (r.length) {
        setFresh(new Set(r.map((e) => e.id)));
        setEvents((old) => [...r, ...old].slice(0, 300));
      }
    }, 10_000);
    return () => clearInterval(t);
  }, [events]);

  const list = onlyKey ? events.filter((e) => KEY.has(e.name)) : events;
  return (
    <Panel eyebrow={`${events.length} eventos recentes`} title="Linha do tempo" pad={false}
      right={<>
        <label className="flex items-center gap-1.5 text-fg-2"><input type="checkbox" checked={onlyKey} onChange={(e) => setOnlyKey(e.target.checked)} />só cadastros e compartilhamentos</label>
        <span className="mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-fg-3"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />ao vivo</span>
      </>}>
      <ol>
        {list.map((e) => (
          <li key={e.id} className={cx("flex items-center gap-3 border-b border-line px-4 py-1.5 transition-colors last:border-0", fresh.has(e.id) && "bg-signal-soft")}>
            <span className="mono w-[86px] shrink-0 text-[11px] text-fg-3" title={date(e.at)}>{time(e.at)}</span>
            <span className={cx("w-52 shrink-0 truncate", KEY.has(e.name) ? "text-fg" : "text-fg-2")}>{EVENT_LABEL[e.name] ?? e.name}</span>
            <span className="mono hidden w-28 shrink-0 truncate text-[11px] text-fg-3 md:block">{e.path}</span>
            <span className="min-w-0 flex-1 truncate">
              {e.lead ? <Link className="hover:underline" href={`/builder/cadastros?id=${e.lead.id}`}><span className="mono text-fg-3">{boraId(e.lead.bora_number)}</span> {e.lead.name} <span className="text-fg-3">· {e.lead.city} {e.lead.state}</span></Link> : <span className="text-fg-3">visitante anônimo</span>}
            </span>
            {e.source && <Chip tone="outline">{e.source}</Chip>}
          </li>
        ))}
      </ol>
      {!list.length && <Empty title="Nenhum evento ainda." />}
    </Panel>
  );
}
