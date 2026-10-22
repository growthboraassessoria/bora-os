-- Meta por cidade da campanha: de 500 para 100 (pedido do Alex, 22/10/2026).
-- Idempotente: pode rodar de novo. Só atualiza linhas que já existem.

update builder.site_settings
set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{city_goal}', '100'::jsonb)
where site_id in ('vamos-em-frente', 'vamos-em-frente-us');
