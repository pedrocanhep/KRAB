import { test } from 'node:test'
import assert from 'node:assert/strict'
import { salvarPerfilSchema } from '../src/schemas/perfil.ts'

test('aceita um nome válido e remove espaços nas pontas', () => {
  const r = salvarPerfilSchema.safeParse({ nome: '  Larissa Pereira  ' })
  assert.equal(r.success, true)
  if (r.success) assert.equal(r.data.nome, 'Larissa Pereira')
})

test('rejeita nome vazio, só com espaços ou ausente', () => {
  for (const corpo of [{ nome: '' }, { nome: '    ' }, {}]) {
    assert.equal(salvarPerfilSchema.safeParse(corpo).success, false, JSON.stringify(corpo))
  }
})

test('aceita 80 caracteres e rejeita 81', () => {
  assert.equal(salvarPerfilSchema.safeParse({ nome: 'a'.repeat(80) }).success, true)
  assert.equal(salvarPerfilSchema.safeParse({ nome: 'a'.repeat(81) }).success, false)
})

test('rejeita nome que não é texto', () => {
  for (const nome of [123, null, ['Ana'], { primeiro: 'Ana' }]) {
    assert.equal(salvarPerfilSchema.safeParse({ nome }).success, false, JSON.stringify(nome))
  }
})

test('o cliente NÃO define user_id nem outros campos', () => {
  for (const extra of [{ user_id: 'x' }, { email: 'a@b.com' }, { created_at: '2026-01-01' }]) {
    assert.equal(salvarPerfilSchema.safeParse({ nome: 'Ana', ...extra }).success, false)
  }
})
