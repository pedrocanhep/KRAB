import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  criarRecorrenciaSchema,
  editarRecorrenciaSchema,
  listarRecorrenciasSchema,
} from '../src/schemas/recorrencia.ts'

const base = {
  conta_id: '3f2b8c1e-5d4a-4b7e-9c1a-2f6d8e0a1b3c',
  descricao: 'Aluguel',
  valor: '1500.00',
  categoria: 'Moradia',
  frequencia: 'mensal',
  data_inicio: '2026-11-05',
}

test('aceita recorrência válida, com e sem data final', () => {
  assert.equal(criarRecorrenciaSchema.safeParse(base).success, true)
  assert.equal(criarRecorrenciaSchema.safeParse({ ...base, data_fim: '2027-11-05' }).success, true)
})

test('aceita as 3 frequências e rejeita outras', () => {
  for (const frequencia of ['diaria', 'semanal', 'mensal']) {
    assert.equal(criarRecorrenciaSchema.safeParse({ ...base, frequencia }).success, true, frequencia)
  }
  for (const frequencia of ['anual', 'quinzenal', '']) {
    assert.equal(criarRecorrenciaSchema.safeParse({ ...base, frequencia }).success, false, frequencia)
  }
})

test('rejeita data final anterior à de início', () => {
  assert.equal(criarRecorrenciaSchema.safeParse({ ...base, data_fim: '2026-11-04' }).success, false)
  assert.equal(criarRecorrenciaSchema.safeParse({ ...base, data_fim: '2026-11-05' }).success, true)
})

test('rejeita valor inválido, datas inexistentes e campos obrigatórios em branco', () => {
  for (const valor of ['0', '-1', '10.999', 1500]) {
    assert.equal(criarRecorrenciaSchema.safeParse({ ...base, valor }).success, false, String(valor))
  }
  assert.equal(criarRecorrenciaSchema.safeParse({ ...base, data_inicio: '2026-02-31' }).success, false)
  assert.equal(criarRecorrenciaSchema.safeParse({ ...base, descricao: '  ' }).success, false)
  assert.equal(criarRecorrenciaSchema.safeParse({ ...base, categoria: '' }).success, false)
})

test('o cliente NÃO define status, user_id nem finalizada_em', () => {
  for (const extra of [{ status: 'finalizada' }, { user_id: 'x' }, { finalizada_em: '2026-01-01' }]) {
    assert.equal(criarRecorrenciaSchema.safeParse({ ...base, ...extra }).success, false)
  }
})

test('edição: exige um campo, aceita data_fim null e NÃO muda frequência nem início', () => {
  assert.equal(editarRecorrenciaSchema.safeParse({}).success, false)
  assert.equal(editarRecorrenciaSchema.safeParse({ valor: '1600.00' }).success, true)
  assert.equal(editarRecorrenciaSchema.safeParse({ data_fim: null }).success, true)
  assert.equal(editarRecorrenciaSchema.safeParse({ data_fim: '2027-01-01' }).success, true)
  assert.equal(editarRecorrenciaSchema.safeParse({ frequencia: 'diaria' }).success, false)
  assert.equal(editarRecorrenciaSchema.safeParse({ data_inicio: '2026-12-01' }).success, false)
  assert.equal(editarRecorrenciaSchema.safeParse({ status: 'finalizada' }).success, false)
})

test('listagem: filtros válidos e inválidos', () => {
  assert.equal(listarRecorrenciasSchema.safeParse({ status: 'ativa' }).success, true)
  assert.equal(listarRecorrenciasSchema.safeParse({ status: 'pausada' }).success, false)
  assert.equal(listarRecorrenciasSchema.safeParse({ limit: '101' }).success, false)
})
