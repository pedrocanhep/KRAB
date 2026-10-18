import type { FastifyInstance } from 'fastify'
import { autenticar } from '../auth.ts'
import { responderErroDb } from '../errors.ts'

export async function resumoDesenvolvimentoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', autenticar)

  // Integração provisória: a soma acontece no PostgreSQL, sem paginação ou
  // cálculo financeiro no navegador. req.db mantém o Bearer e a RLS existentes.
  app.get('/resumo-desenvolvimento', async (req, reply) => {
    const { data, error } = await req.db.rpc('resumo_desenvolvimento')
    if (error) return responderErroDb(reply, error)
    return data
  })
}
