import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarTentativaIdempotente } from '../src/services/idempotencia.ts'

test('resposta perdida: reenvio do mesmo payload mantém a chave', () => {
  const tentativa = criarTentativaIdempotente()
  const payload = { conta_id: 'conta-a', valor: '10.00', descricao: 'Venda' }
  const chave = tentativa.chavePara(payload)
  assert.match(chave, /^[A-Za-z0-9_-]{8,100}$/)
  assert.equal(tentativa.chavePara({ ...payload }), chave)
})

test('mudança de conta, valor ou descrição não reutiliza a tentativa anterior', () => {
  const tentativa = criarTentativaIdempotente()
  const payload = { conta_id: 'conta-a', valor: '10.00', descricao: 'Venda' }
  let anterior = tentativa.chavePara(payload)
  for (const alteracao of [
    { conta_id: 'conta-b' },
    { valor: '20.00' },
    { descricao: 'Outra venda' },
  ]) {
    const chave = tentativa.chavePara({ ...payload, ...alteracao })
    assert.notEqual(chave, anterior)
    anterior = chave
  }
})

test('sucesso permite novo lançamento idêntico com outra chave', () => {
  const tentativa = criarTentativaIdempotente()
  const payload = { valor: '10.00' }
  const anterior = tentativa.chavePara(payload)
  tentativa.concluir()
  assert.notEqual(tentativa.chavePara(payload), anterior)
})

test('formulários de receitas e despesas têm tentativas independentes', () => {
  const payload = { valor: '10.00' }
  assert.notEqual(
    criarTentativaIdempotente().chavePara(payload),
    criarTentativaIdempotente().chavePara(payload),
  )
})
