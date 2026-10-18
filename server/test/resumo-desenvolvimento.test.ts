import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import Fastify from 'fastify'

// Substituímos somente a fronteira Supabase, antes de importar a rota. O hook
// autenticar real continua em execução. Sem .env, conexão ou credencial real.
const estado = {
  consultas: 0,
  resposta: {
    data: { entradas: 1240, saidas: 760, saldo: 480 },
    error: null as null | { message: string; code: string },
  },
}
const chave = '__krabTesteResumo'
Object.assign(globalThis, { [chave]: estado })
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('/src/supabase.ts')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export function clienteDoUsuario(token) {
          return {
            auth: { async getUser() { return token === 'sessao-teste' ? {data:{user:{id:'usuario-teste'}},error:null} : {data:{user:null},error:{message:'invalid'}}; } },
            async rpc(nome) {
              if (nome !== 'resumo_desenvolvimento') throw new Error('RPC inesperada');
              globalThis.${chave}.consultas++;
              return globalThis.${chave}.resposta;
            }
          };
        }`,
      }
    }
    return nextLoad(url, context)
  },
})
const { resumoDesenvolvimentoRoutes } = await import('../src/routes/resumo-desenvolvimento.ts')
hooks.deregister()

test('rota provisória exige Bearer, retorna os totais e trata falha de leitura', async () => {
  const app = Fastify({ logger: false })
  await app.register(resumoDesenvolvimentoRoutes)
  try {
    for (const authorization of [undefined, 'Basic sessao-teste', 'Bearer invalida']) {
      const resposta = await app.inject({
        method: 'GET',
        url: '/resumo-desenvolvimento',
        headers: authorization ? { authorization } : {},
      })
      assert.equal(resposta.statusCode, 401)
    }
    assert.equal(estado.consultas, 0, 'Não consulta totais sem autenticação válida')
    const resposta = await app.inject({
      method: 'GET',
      url: '/resumo-desenvolvimento',
      headers: { authorization: 'Bearer sessao-teste' },
    })
    assert.equal(resposta.statusCode, 200)
    assert.deepEqual(resposta.json(), { entradas: 1240, saidas: 760, saldo: 480 })
    assert.equal(estado.consultas, 1)
    estado.resposta.error = { message: 'Falha simulada', code: 'XX000' }
    const falha = await app.inject({
      method: 'GET',
      url: '/resumo-desenvolvimento',
      headers: { authorization: 'Bearer sessao-teste' },
    })
    assert.equal(falha.statusCode, 500)
    assert.equal(falha.json().erro, 'erro_interno')
  } finally {
    await app.close()
    Reflect.deleteProperty(globalThis, chave)
  }
})
