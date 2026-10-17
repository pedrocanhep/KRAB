import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extratoSchema, relatorioSchema, somarDias } from '../src/schemas/relatorio.ts'

test('somarDias: janela de 30 dias termina em "hoje" e começa 29 dias antes', () => {
  assert.equal(somarDias('2026-10-15', -29), '2026-09-16')
  assert.equal(somarDias('2026-03-01', -1), '2026-02-28')
})

test('extrato: sem datas, usa os últimos 30 dias e os padrões', () => {
  const r = extratoSchema.safeParse({})
  assert.equal(r.success, true)
  if (r.success) {
    assert.equal(r.data.tipo, 'todos')
    assert.equal(r.data.ordem, 'data')
    assert.equal(r.data.limit, 100)
    assert.equal(somarDias(r.data.ate, -29), r.data.de)
  }
})

test('extrato: só "ate" informado calcula o "de" 29 dias antes', () => {
  const r = extratoSchema.safeParse({ ate: '2026-10-15' })
  assert.equal(r.success, true)
  if (r.success) assert.equal(r.data.de, '2026-09-16')
})

test('extrato: data inicial posterior à final é "Intervalo de datas inválido"', () => {
  const r = extratoSchema.safeParse({ de: '2026-10-10', ate: '2026-10-01' })
  assert.equal(r.success, false)
  if (!r.success) assert.match(r.error.issues[0]?.message ?? '', /Intervalo de datas inválido/)
})

test('extrato: rejeita tipo, ordem, limite e conta_id inválidos', () => {
  assert.equal(extratoSchema.safeParse({ tipo: 'tudo' }).success, false)
  assert.equal(extratoSchema.safeParse({ ordem: 'valor' }).success, false)
  assert.equal(extratoSchema.safeParse({ limit: '501' }).success, false)
  assert.equal(extratoSchema.safeParse({ limit: '0' }).success, false)
  assert.equal(extratoSchema.safeParse({ conta_id: 'abc' }).success, false)
})

test('extrato: converte limit e offset vindos da URL (texto)', () => {
  const r = extratoSchema.safeParse({ limit: '10', offset: '20' })
  assert.equal(r.success, true)
  if (r.success) assert.deepEqual([r.data.limit, r.data.offset], [10, 20])
})

test('relatório: período padrão e validação de datas', () => {
  assert.equal(relatorioSchema.safeParse({}).success, true)
  assert.equal(relatorioSchema.safeParse({ de: '2026-02-31' }).success, false)
  assert.equal(relatorioSchema.safeParse({ de: '2026-10-10', ate: '2026-10-01' }).success, false)
})
