import type { FastifyReply } from 'fastify'

type ErroDb = { message: string; code?: string }

// As funções SQL levantam exceções com estes textos (ver as migrations).
const MENSAGENS: Record<string, { status: number; mensagem: string }> = {
  nao_autenticado: { status: 401, mensagem: 'Não autenticado.' },
  conta_nao_encontrada: { status: 404, mensagem: 'Conta não encontrada.' },
  receita_nao_encontrada: { status: 404, mensagem: 'Receita não encontrada.' },
  despesa_nao_encontrada: { status: 404, mensagem: 'Despesa não encontrada.' },
  estado_invalido: { status: 409, mensagem: 'Operação não permitida para um lançamento excluído.' },
  conta_nao_alteravel: { status: 409, mensagem: 'Não é possível trocar a conta de uma despesa já paga.' },
  conflito_concorrencia: { status: 409, mensagem: 'O registro foi alterado ao mesmo tempo. Tente novamente.' },
  data_pagamento_invalida: { status: 422, mensagem: 'A data de pagamento não pode ser futura.' },
}

// Códigos do Postgres para "dado inválido" (check, uuid ruim, data ruim, número fora do limite).
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
  // Não vazamos detalhes internos ao cliente; o detalhe vai para o log.
  reply.log.error({ error }, 'erro inesperado do banco')
  return reply.code(500).send({ erro: 'erro_interno', mensagem: 'Não foi possível concluir a operação.' })
}
