// Chave de serviço. Só para o que o Auth exige: criar membro, trocar senha provisória, zerar segundo fator.
// Toda chamada daqui vem depois de conferir a permissão do membro com a sessão dele (lib/auth.ts).
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
