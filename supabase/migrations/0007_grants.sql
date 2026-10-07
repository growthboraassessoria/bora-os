-- 0007 · A chave de serviço executa todas as funções dos schemas do OS (inclusive as criadas depois).
grant execute on all functions in schema os, builder, mcp to service_role;
alter default privileges in schema os grant execute on functions to service_role;
alter default privileges in schema builder grant execute on functions to service_role;
alter default privileges in schema mcp grant execute on functions to service_role;
