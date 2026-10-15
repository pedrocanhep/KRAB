import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  criarDespesaSchema,
  editarDespesaSchema,
  listarDespesasSchema,
  pagarDespesaSchema,
} from '../src/schemas/despesa.ts'

const base = {
  conta_id: '3f2b8c1e-5d4a-4b7e-9c1a-2f6d8e0a1b3c',
  descricao: 'Conta de água',
  valor: '150.00',
  data_vencimento: '2026-10-15',
  categoria: 'Contas',
}

test('aceita uma despesa válida', () => {
  assert.equal(criarDespesaSchema.safeParse(base).success, true)
})

test('rejeita valor zero, negativo, com 3 casas ou número (não string)', () => {
  for (const valor of ['0', '-5', '10.999', 'abc', 150]) {
    assert.equal(criarDespesaSchema.safeParse({ ...base, valor }).success, false, String(valor))
  }
})

test('rejeita campos obrigatórios em branco', () => {
  assert.equal(criarDespesaSchema.safeParse({ ...base, descricao: '  ' }).success, false)
  assert.equal(criarDespesaSchema.safeParse({ ...base, categoria: '' }).success, false)
})

test('rejeita vencimento inexistente', () => {
  assert.equal(criarDespesaSchema.safeParse({ ...base, data_vencimento: '2026-02-31' }).success, false)
})

test('NÃO aceita o cliente definir status, valor_pago ou user_id na criação', () => {
  for (const extra of [{ status: 'paga' }, { valor_pago: '150.00' }, { user_id: 'x' }]) {
    assert.equal(criarDespesaSchema.safeParse({ ...base, ...extra }).success, false)
  }
})

test('edição: exige ao menos um campo; aceita conta_id (o banco decide se pode)', () => {
  assert.equal(editarDespesaSchema.safeParse({}).success, false)
  assert.equal(editarDespesaSchema.safeParse({ valor: '99.90' }).success, true)
  assert.equal(editarDespesaSchema.safeParse({ conta_id: base.conta_id }).success, true)
  assert.equal(editarDespesaSchema.safeParse({ status: 'paga' }).success, false)
})

test('pagamento: só aceita data opcional (pagamento é integral, sem valor_pago)', () => {
  assert.equal(pagarDespesaSchema.safeParse({}).success, true)
  assert.equal(pagarDespesaSchema.safeParse({ data_pagamento: '2026-10-10' }).success, true)
  assert.equal(pagarDespesaSchema.safeParse({ valor_pago: '10.00' }).success, false)
})

test('listagem: filtros e intervalo de datas', () => {
  assert.equal(listarDespesasSchema.safeParse({ status: 'pendente' }).success, true)
  assert.equal(listarDespesasSchema.safeParse({ status: 'atrasada' }).success, false)
  assert.equal(listarDespesasSchema.safeParse({ de: '2026-10-10', ate: '2026-10-01' }).success, false)
})
