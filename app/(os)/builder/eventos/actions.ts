"use server";
import { actionAuth } from "@/lib/auth";
import { rpc, SITE_ID } from "@/lib/builder";
import type { Ev } from "./LiveFeed";

export async function pollEvents(after: string | null): Promise<Ev[]> {
  try {
    const a = await actionAuth("builder.analytics.read");
    return await rpc<Ev[]>(a.db, "recent_events", { f: { site_id: SITE_ID, after, limit: 100 } });
  } catch {
    return [];
  }
}
