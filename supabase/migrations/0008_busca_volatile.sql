-- 0008 · A busca usa tabela temporária: não pode ser stable.
alter function builder._search_leads(jsonb, jsonb) volatile;
