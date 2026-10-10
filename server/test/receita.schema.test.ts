import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  criarReceitaSchema,
  editarReceitaSchema,
  listarReceitasSchema,
} from '../src/schemas/receita.ts'

const base = {
  conta_id: '3f2b8c1e-5d4a-4b7e-9c1a-2f6d8e0a1b3c',
  descricao: 'Salário',
  valor: '1200.00',
  data_recebimento: '2026-10-09',
  categoria: 'Salário',
}

test('aceita uma receita válida', () => {
  assert.equal(criarReceitaSchema.safeParse(base).success, true)
})

test('rejeita valor zero, negativo, com 3 casas ou número (não string)', () => {
  for (const valor of ['0', '0.00', '-5', '10.999', 'abc', 1200]) {
    assert.equal(criarReceitaSchema.safeParse({ ...base, valor }).success, false, String(valor))
  }
})

test('rejeita descrição ou categoria em branco', () => {
  assert.equal(criarReceitaSchema.safeParse({ ...base, descricao: '   ' }).success, false)
  assert.equal(criarReceitaSchema.safeParse({ ...base, categoria: '' }).success, false)
})

test('rejeita data inexistente ou em formato errado', () => {
  for (const data_recebimento of ['2026-02-31', '09/10/2026', '2026-13-01']) {
    assert.equal(criarReceitaSchema.safeParse({ ...base, data_recebimento }).success, false)
  }
})

test('rejeita campos extras (ex.: user_id enviado pelo cliente)', () => {
  assert.equal(criarReceitaSchema.safeParse({ ...base, user_id: 'x' }).success, false)
})

test('edição: exige ao menos um campo e não permite trocar conta_id', () => {
  assert.equal(editarReceitaSchema.safeParse({}).success, false)
  assert.equal(editarReceitaSchema.safeParse({ conta_id: base.conta_id }).success, false)
  assert.equal(editarReceitaSchema.safeParse({ valor: '50.00' }).success, true)
})

test('listagem: data inicial posterior à final é inválida', () => {
  assert.equal(listarReceitasSchema.safeParse({ de: '2026-10-10', ate: '2026-10-01' }).success, false)
  assert.equal(listarReceitasSchema.safeParse({ de: '2026-10-01', ate: '2026-10-10' }).success, true)
})
