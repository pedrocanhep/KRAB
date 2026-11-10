import { after, test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = 'http://supabase.teste'
process.env.SUPABASE_ANON_KEY = 'chave-anon-de-teste'
const { buildApp } = await import('../src/app.ts')
const app = buildApp()
const fetchOriginal = globalThis.fetch
const id = '3f2b8c1e-5d4a-4b7e-9c1a-2f6d8e0a1b3c'
const headers = { authorization: 'Bearer token-teste' }
let erroRpc = ''
let chamadasRpc = 0

// alteração Pedro: não havia simulação HTTP dedicada às novas regras financeiras; agora as RPCs são simuladas sem acessar o Supabase real.
// Verifica o contrato HTTP e tradução de erros; não simula a contabilidade SQL.
globalThis.fetch = (async (url: string | URL | Request) => {
  if (String(url).includes('/auth/v1/user')) {
    return Response.json({ id, aud: 'authenticated', email: 'teste@krab.invalid' })
  }
  if (String(url).includes('/rest/v1/rpc/')) {
    chamadasRpc++
    return Response.json({ message: erroRpc, code: 'P0001' }, { status: 400 })
  }
  throw new Error('Chamada inesperada no teste')
}) as typeof fetch

after(async () => {
  globalThis.fetch = fetchOriginal
  await app.close()
})

// alteração Pedro: não havia teste HTTP para receitas futuras; agora POST e PATCH devem retornar 422 antes da RPC.
test('POST e PATCH de receita futura retornam 422 antes da RPC', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-09T01:00:00Z') })
  const antes = chamadasRpc
  for (const method of ['POST', 'PATCH'] as const) {
    const payload =
      method === 'POST'
        ? {
            conta_id: id,
            descricao: 'Venda',
            valor: '10.00',
            categoria: 'Teste',
            data_recebimento: '2026-11-09',
          }
        : { data_recebimento: '2026-11-09' }
    const resposta = await app.inject({
      method,
      url: method === 'POST' ? '/receitas' : `/receitas/${id}`,
      headers,
      payload,
    })
    assert.equal(resposta.statusCode, 422)
    assert.match(resposta.body, /A data de recebimento não pode ser futura/)
  }
  assert.equal(chamadasRpc, antes)
})

// alteração Pedro: a nova rejeição SQL não tinha cobertura HTTP; agora sua tradução para 422 e mensagem é verificada.
test('erro de negócio da RPC de receita também retorna 422 compreensível', async () => {
  erroRpc = 'data_recebimento_invalida'
  const resposta = await app.inject({
    method: 'PATCH',
    url: `/receitas/${id}`,
    headers,
    payload: { valor: '10.00' },
  })
  assert.equal(resposta.statusCode, 422)
  assert.deepEqual(resposta.json(), {
    erro: erroRpc,
    mensagem: 'A data de recebimento não pode ser futura.',
  })
})

// alteração Pedro: os novos bloqueios de conta não tinham cobertura de contrato; agora os erros retornados pela RPC são verificados como HTTP 409.
test('bloqueios de exclusão e conta excluída retornam 409 com orientação', async () => {
  for (const erro of ['conta_com_saldo', 'conta_com_pendencias']) {
    erroRpc = erro
    const resposta = await app.inject({ method: 'DELETE', url: `/contas/${id}`, headers })
    assert.equal(resposta.statusCode, 409)
    assert.equal(resposta.json().erro, erro)
  }
  erroRpc = 'conta_excluida'
  for (const [method, url, payload] of [
    ['PATCH', `/receitas/${id}`, { valor: '11.00' }],
    ['POST', `/receitas/${id}/restauracao`, {}],
    ['PATCH', `/despesas/${id}`, { descricao: 'Outra' }],
    ['POST', `/despesas/${id}/pagamento`, {}],
    ['POST', `/despesas/${id}/restauracao`, {}],
  ] as const) {
    const resposta = await app.inject({ method, url, headers, payload })
    assert.equal(resposta.statusCode, 409)
    assert.deepEqual(resposta.json(), {
      erro: erroRpc,
      mensagem: 'Restaure a conta antes de realizar operações financeiras.',
    })
  }
})
