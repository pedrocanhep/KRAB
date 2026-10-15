import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarContaSchema, editarContaSchema, listarContasSchema } from '../src/schemas/conta.ts'

test('aceita conta mínima (só o nome) e aplica os padrões', () => {
  const r = criarContaSchema.safeParse({ nome: 'Caixa interno' })
  assert.equal(r.success, true)
  if (r.success) {
    assert.equal(r.data.tipo, 'corrente')
    assert.equal(r.data.saldo_inicial, '0.00')
  }
})

test('aceita conta bancária completa com saldo inicial negativo', () => {
  const r = criarContaSchema.safeParse({
    nome: 'Banco A', tipo: 'poupanca', saldo_inicial: '-100.50',
    cod_banco: '260', agencia: '1234', num_conta: '567890', digito_verificador: '1',
  })
  assert.equal(r.success, true)
})

test('rejeita nome vazio, tipo inválido e saldo mal formatado', () => {
  assert.equal(criarContaSchema.safeParse({ nome: '  ' }).success, false)
  assert.equal(criarContaSchema.safeParse({ nome: 'A', tipo: 'cartao' }).success, false)
  for (const saldo_inicial of ['abc', '1.234', '10,50', 500]) {
    assert.equal(criarContaSchema.safeParse({ nome: 'A', saldo_inicial }).success, false, String(saldo_inicial))
  }
})

test('rejeita campos bancários fora do formato', () => {
  for (const extra of [{ cod_banco: '12345' }, { agencia: '12a' }, { num_conta: '1'.repeat(16) }, { digito_verificador: '123' }]) {
    assert.equal(criarContaSchema.safeParse({ nome: 'A', ...extra }).success, false)
  }
})

test('rejeita campos que o cliente não pode definir (user_id, saldo_disponivel)', () => {
  for (const extra of [{ user_id: 'x' }, { saldo_disponivel: '999.00' }]) {
    assert.equal(criarContaSchema.safeParse({ nome: 'A', ...extra }).success, false)
  }
})

test('edição: exige ao menos um campo, aceita null para limpar e NÃO aceita saldo', () => {
  assert.equal(editarContaSchema.safeParse({}).success, false)
  assert.equal(editarContaSchema.safeParse({ agencia: null }).success, true)
  assert.equal(editarContaSchema.safeParse({ nome: 'Novo nome' }).success, true)
  assert.equal(editarContaSchema.safeParse({ saldo_disponivel: '10.00' }).success, false)
  assert.equal(editarContaSchema.safeParse({ saldo_inicial: '10.00' }).success, false)
})

test('listagem: filtros válidos e inválidos', () => {
  assert.equal(listarContasSchema.safeParse({ tipo: 'caixa', situacao: 'todas' }).success, true)
  assert.equal(listarContasSchema.safeParse({ situacao: 'apagadas' }).success, false)
})
