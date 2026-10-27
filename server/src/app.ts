import Fastify from 'fastify'
import cors from '@fastify/cors'
import { ZodError } from 'zod'
import { config } from './config.ts'
import { authRoutes } from './routes/auth.ts'
import { atividadesRoutes } from './routes/atividades.ts'
import { contasRoutes } from './routes/contas.ts'
import { despesasRoutes } from './routes/despesas.ts'
import { receitasRoutes } from './routes/receitas.ts'
import { recorrenciasRoutes } from './routes/recorrencias.ts'
import { resumoDesenvolvimentoRoutes } from './routes/resumo-desenvolvimento.ts'
import { relatoriosRoutes } from './routes/relatorios.ts'
import { perfilRoutes } from './routes/perfil.ts'
import { movimentacoesRoutes } from './routes/movimentacoes.ts'



export function buildApp() {
  const app = Fastify({ logger: true })

  app.register(cors, { origin: config.corsOrigin })
  app.register(perfilRoutes)
  app.register(movimentacoesRoutes)

  app.get('/health', async () => ({ status: 'ok' }))
  app.register(authRoutes)
  app.register(receitasRoutes)
  app.register(despesasRoutes)
  app.register(contasRoutes)
  app.register(atividadesRoutes)
  app.register(relatoriosRoutes)
  app.register(resumoDesenvolvimentoRoutes)
  app.register(recorrenciasRoutes)

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
