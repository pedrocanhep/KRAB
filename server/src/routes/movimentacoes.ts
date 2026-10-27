import type { FastifyInstance } from 'fastify'
import { autenticar } from '../auth.ts'
import { responderErroDb } from '../errors.ts'
import { listarMovimentacoesSchema } from '../schemas/movimentacao.ts'

// SOMENTE LEITURA. A função SQL roda como o usuário (RLS): cada pessoa só vê o próprio histórico.
export async function movimentacoesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', autenticar)

  // Histórico de movimentações do saldo (mais recente primeiro), com o saldo após cada uma.
  app.get('/movimentacoes', async (req, reply) => {
    const f = listarMovimentacoesSchema.parse(req.query)

    const { data, error } = await req.db.rpc('movimentacoes', {
      p_conta_id: f.conta_id ?? null,
      p_de: f.de ?? null,
      p_ate: f.ate ?? null,
      p_origem: f.origem,
      p_limit: f.limit,
      p_offset: f.offset,
    })
    if (error) return responderErroDb(reply, error)
    return { ...data, limit: f.limit, offset: f.offset }
  })
}
