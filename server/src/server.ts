import { buildApp } from './app.ts'
import { config } from './config.ts'

const app = buildApp()

try {
  await app.listen({ port: config.port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
