import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listarMovimentacoesSchema } from '../src/schemas/movimentacao.ts'

test('sem filtros: lista tudo, com os padrões', () => {
  const r = listarMovimentacoesSchema.safeParse({})
  assert.equal(r.success, true)
  if (r.success) {
    assert.equal(r.data.origem, 'todas')
    assert.equal(r.data.limit, 50)
    assert.equal(r.data.offset, 0)
    assert.equal(r.data.de, undefined)
    assert.equal(r.data.ate, undefined)
  }
})

test('aceita as 4 origens e rejeita outras', () => {
  for (const origem of ['todas', 'receita', 'despesa', 'ajuste']) {
    assert.equal(listarMovimentacoesSchema.safeParse({ origem }).success, true, origem)
  }
  for (const origem of ['receitas', 'transferencia', '']) {
    assert.equal(listarMovimentacoesSchema.safeParse({ origem }).success, false, origem)
  }
})

test('período: valida datas e rejeita intervalo invertido', () => {
  assert.equal(
    listarMovimentacoesSchema.safeParse({ de: '2026-10-01', ate: '2026-10-31' }).success,
    true,
  )
  assert.equal(listarMovimentacoesSchema.safeParse({ de: '2026-02-31' }).success, false)
  const r = listarMovimentacoesSchema.safeParse({ de: '2026-10-10', ate: '2026-10-01' })
  assert.equal(r.success, false)
  if (!r.success) assert.match(r.error.issues[0]?.message ?? '', /Intervalo de datas inválido/)
})

test('limit de 1 a 200, offset a partir de 0, conta_id precisa ser UUID', () => {
  assert.equal(listarMovimentacoesSchema.safeParse({ limit: '200' }).success, true)
  assert.equal(listarMovimentacoesSchema.safeParse({ limit: '201' }).success, false)
  assert.equal(listarMovimentacoesSchema.safeParse({ limit: '0' }).success, false)
  assert.equal(listarMovimentacoesSchema.safeParse({ offset: '-1' }).success, false)
  assert.equal(listarMovimentacoesSchema.safeParse({ conta_id: 'abc' }).success, false)
  const r = listarMovimentacoesSchema.safeParse({ limit: '10', offset: '20' })
  assert.equal(r.success, true)
  if (r.success) assert.deepEqual([r.data.limit, r.data.offset], [10, 20])
})
