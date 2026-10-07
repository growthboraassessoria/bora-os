// Chamadas às funções do schema builder com a sessão do membro. O banco confere permissão e escopo.
import "server-only";
import type { Db } from "./supabase/server";

export async function rpc<T = unknown>(db: Db, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.schema("builder").rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const SITE_ID = "vamos-em-frente";

export type LeadRow = {
  id: string; bora_number: number; first_name: string; last_name: string; email: string; phone: string; cpf: string | null; birth_date: string | null;
  pii_masked: boolean; sex: string | null; cep: string; city_slug: string; city: string; state: string; referral_code: string; referred_by: string | null;
  privacy_consent: boolean; marketing_consent: boolean; utm: Record<string, string | null>; first_touch: Record<string, string> | null; last_touch: Record<string, string> | null;
  experiment: Record<string, string> | null; external_ids: Record<string, string>; site_id: string; source: string; created_at: string; updated_at: string | null;
  anonymized_at: string | null; phone2?: string | null; instagram?: string | null; bio?: string | null; photo_url?: string | null;
  public_profile?: boolean; public_whatsapp?: boolean; last_login_at?: string | null; direct?: number; answered?: boolean; founder?: boolean; tags?: string[];
};

export type LeadDetail = LeadRow & {
  can_reveal: boolean;
  referrer: { id: string; bora_number: number; name: string; city: string; state: string } | null;
  network: { signups: number; network: number };
  referral_clicks: number;
  referred: { id: string; bora_number: number; name: string; city: string; state: string; created_at: string }[];
  answers: Record<string, string>;
  founder: { founder_number: number; status: string; amount: number | null; purchased_at: string | null } | null;
  events: { name: string; at: string; path: string | null; props: Record<string, unknown> }[];
  notes: { id: string; body: string; at: string; author: string | null }[];
  history: { at: string; action: string; actor_type: string; actor: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }[];
};

export { QUESTION_LABEL, EVENT_LABEL } from "./eventLabels";
