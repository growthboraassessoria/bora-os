// Mensagens dos erros do banco e do Auth, em português e sem detalhe técnico.
const MAP: [RegExp, string][] = [
  [/sem_permissao: builder\.leads\.pii/, "Você não tem permissão para ver ou buscar dados pessoais."],
  [/sem_permissao: escopo/, "Esse cadastro está fora do seu escopo."],
  [/sem_permissao: acima_do_criador/, "Uma conexão não pode ter permissões que você não tem."],
  [/sem_permissao|42501|permission denied/i, "Você não tem permissão para isso."],
  [/segundo_fator_obrigatorio/, "Confirme o código do autenticador para continuar."],
  [/confirmacao_necessaria/, "Confirme o código do autenticador para continuar."],
  [/proprietario_tem_todas/, "O papel Proprietário tem todas as permissões e não pode ser alterado."],
  [/papel_do_sistema/, "Papéis do sistema não podem ser apagados nem renomeados."],
  [/so_proprietario/, "Só um proprietário pode conceder ou retirar o papel Proprietário."],
  [/precisa_de_um_proprietario/, "O sistema precisa de pelo menos um proprietário ativo."],
  [/invalido: email/, "Confere o e-mail."],
  [/invalido: telefone/, "Telefone com DDD, 10 ou 11 dígitos."],
  [/invalido: cep/, "CEP com 8 dígitos."],
  [/invalido: cpf/, "CPF com 11 dígitos."],
  [/invalido: nome/, "Nome e sobrenome são obrigatórios."],
  [/invalido: cidade/, "Não achamos a cidade desse CEP."],
  [/invalido: codigo_indicador/, "Código de indicação não encontrado."],
  [/invalido: validade/, "Validade entre 1 e 90 dias."],
  [/invalido: permissao_administrativa/, "Conexões MCP não recebem permissões de Admin nem de MCP."],
  [/cadastro_anonimizado/, "Cadastro anonimizado não pode ser editado."],
  [/nao_encontrado/, "Não encontrado."],
  [/duplicate key|23505/, "Já existe um registro com esses dados."],
  [/Invalid login credentials/i, "E-mail ou senha não conferem."],
  [/Invalid TOTP code|invalid.*code/i, "Código inválido. Confira o horário do celular e tente o próximo."],
  [/rate limit|too many/i, "Muitas tentativas. Espere alguns minutos."],
  [/weak|Password should/i, "Senha fraca: use 12+ caracteres com maiúscula, minúscula, número e símbolo."],
];

export function message(e: unknown): string {
  const raw = typeof e === "string" ? e : e instanceof Error ? e.message : (e as { message?: string })?.message ?? "";
  for (const [re, msg] of MAP) if (re.test(raw)) return msg;
  return "Algo deu errado. Tente de novo.";
}

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; stepUp?: boolean };

export function fail(e: unknown): ActionResult<never> {
  const raw = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return { ok: false, error: message(e), stepUp: raw === "confirmacao_necessaria" };
}
