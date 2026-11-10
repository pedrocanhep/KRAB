import type { FastifyReply } from 'fastify'

type ErroDb = { message: string; code?: string }

const MENSAGENS: Record<string, { status: number; mensagem: string }> = {
  nao_autenticado: { status: 401, mensagem: 'Não autenticado.' },
  conta_nao_encontrada: { status: 404, mensagem: 'Conta não encontrada.' },
  receita_nao_encontrada: { status: 404, mensagem: 'Receita não encontrada.' },
  despesa_nao_encontrada: { status: 404, mensagem: 'Despesa não encontrada.' },
  estado_invalido: { status: 409, mensagem: 'Operação não permitida para um registro excluído.' },
  conta_nao_alteravel: {
    status: 409,
    mensagem: 'Não é possível trocar a conta de uma despesa já paga.',
  },
  conflito_concorrencia: {
    status: 409,
    mensagem: 'O registro foi alterado ao mesmo tempo. Tente novamente.',
  },
  nome_ja_existe: { status: 409, mensagem: 'Já existe uma conta ativa com esse nome.' },
  conta_com_pendencias: {
    status: 409,
    mensagem: 'A conta tem despesas pendentes. Pague ou exclua essas despesas antes.',
  },
  // alteração Pedro: saldo não zero não tinha erro específico; exclusão bloqueada recebe HTTP 409 com mensagem de saldo zero.
  conta_com_saldo: {
    status: 409,
    mensagem: 'A conta precisa estar com saldo zero para ser excluída.',
  },
  // alteração Pedro: operações em conta excluída não tinham orientação específica; HTTP 409 solicita restaurar a conta.
  conta_excluida: {
    status: 409,
    mensagem: 'Restaure a conta antes de realizar operações financeiras.',
  },
  recorrencia_nao_encontrada: { status: 404, mensagem: 'Recorrência não encontrada.' },
  inicio_muito_antigo: {
    status: 422,
    mensagem: 'A data de início não pode ser anterior a 31 dias atrás.',
  },
  data_pagamento_invalida: { status: 422, mensagem: 'A data de pagamento não pode ser futura.' },
  // alteração Pedro: recebimento futuro não tinha erro de negócio; a rejeição da RPC é traduzida para HTTP 422.
  data_recebimento_invalida: {
    status: 422,
    mensagem: 'A data de recebimento não pode ser futura.',
  },
}

const CODIGOS_422 = new Set(['23514', '22P02', '22007', '22008', '22003'])

export function responderErroDb(reply: FastifyReply, error: ErroDb) {
  for (const [chave, info] of Object.entries(MENSAGENS)) {
    if (error.message.includes(chave)) {
      return reply.code(info.status).send({ erro: chave, mensagem: info.mensagem })
    }
  }
  if (error.code && CODIGOS_422.has(error.code)) {
    return reply
      .code(422)
      .send({ erro: 'dados_invalidos', mensagem: 'Algum valor viola as regras de validação.' })
  }

  reply.log.error({ error }, 'erro inesperado do banco')
  return reply
    .code(500)
    .send({ erro: 'erro_interno', mensagem: 'Não foi possível concluir a operação.' })
}
