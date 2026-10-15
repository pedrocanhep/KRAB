import Fastify from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'
import { config } from './config.ts'
import { despesasRoutes } from './routes/despesas.ts'
import { receitasRoutes } from './routes/receitas.ts'

export function buildApp() {
  const app = Fastify({ logger: true })

  app.register(cors, { origin: config.corsOrigin })

  app.get('/health', async () => ({ status: 'ok' }))
  app.register(receitasRoutes)
  app.register(despesasRoutes)

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send({
        erro: 'dados_invalidos',
        detalhes: error.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
      })
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status < 500) {
      return reply.code(status).send({ erro: 'requisicao_invalida', mensagem: (error as Error).message })
    }
    app.log.error(error)
    return reply.code(500).send({ erro: 'erro_interno', mensagem: 'Erro interno do servidor.' })
  })

  return app
}
