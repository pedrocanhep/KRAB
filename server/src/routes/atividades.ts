import type { FastifyInstance } from 'fastify'
import { autenticar } from '../auth.ts'
import { responderErroDb } from '../errors.ts'
import { LIMITE_ATIVIDADES, listarAtividades } from '../services/atividades.ts'

export async function atividadesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', autenticar)

  app.get('/atividades-recentes', async (req, reply) => {
    const resultado = await listarAtividades(req.db)
    if (resultado.error) return responderErroDb(reply, resultado.error)
    return { itens: resultado.itens, limit: LIMITE_ATIVIDADES }
  })
}
