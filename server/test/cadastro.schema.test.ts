import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SENHA_MINIMA, cadastroSchema, reenviarConfirmacaoSchema } from '../src/schemas/cadastro.ts'
import { traduzirErroCadastro } from '../src/errosCadastro.ts'
import { criarLimitador } from '../src/limitador.ts'

const base = {
  nome: 'Ana Souza',
  email: 'ana@exemplo.com',
  password: 'senha1234',
  confirmar_senha: 'senha1234',
}

test('aceita um cadastro válido e normaliza nome e e-mail', () => {
  const r = cadastroSchema.safeParse({ ...base, nome: '  Ana Souza ', email: '  ANA@Exemplo.COM ' })
  assert.equal(r.success, true)
  if (r.success) {
    assert.equal(r.data.nome, 'Ana Souza')
    assert.equal(r.data.email, 'ana@exemplo.com')
  }
})

test('a senha tem mínimo de 8 caracteres e máximo de 72 bytes', () => {
  assert.equal(SENHA_MINIMA, 8)
  const com = (password: string) =>
    cadastroSchema.safeParse({ ...base, password, confirmar_senha: password })
  assert.equal(com('1234567').success, false)
  assert.equal(com('12345678').success, true)
  assert.equal(com('a'.repeat(72)).success, true)
  assert.equal(com('a'.repeat(73)).success, false)
  // "é" ocupa 2 bytes: 37 deles passam de 72 bytes, mesmo sendo só 37 caracteres.
  assert.equal(com('é'.repeat(37)).success, false)
})

test('a senha não é alterada: espaços nas pontas contam', () => {
  const r = cadastroSchema.safeParse({
    ...base,
    password: '  1234567',
    confirmar_senha: '  1234567',
  })
  assert.equal(r.success, true)
  if (r.success) assert.equal(r.data.password, '  1234567')
})

test('rejeita senhas que não conferem', () => {
  const r = cadastroSchema.safeParse({ ...base, confirmar_senha: 'outra-senha' })
  assert.equal(r.success, false)
  if (!r.success) assert.equal(r.error.issues[0]?.path.join('.'), 'confirmar_senha')
})

test('rejeita e-mails inválidos', () => {
  for (const email of ['ana', 'ana@', '@exemplo.com', 'ana@exemplo', 'ana exemplo@x.com', '']) {
    assert.equal(cadastroSchema.safeParse({ ...base, email }).success, false, email)
  }
})

test('rejeita nome vazio, só com espaços ou com mais de 80 caracteres', () => {
  for (const nome of ['', '   ', 'a'.repeat(81)]) {
    assert.equal(cadastroSchema.safeParse({ ...base, nome }).success, false, nome)
  }
  assert.equal(cadastroSchema.safeParse({ ...base, nome: 'a'.repeat(80) }).success, true)
})

test('campos ausentes e campos extras são rejeitados (nada de role ou user_id)', () => {
  for (const campo of ['nome', 'email', 'password', 'confirmar_senha']) {
    const sem: Record<string, string> = { ...base }
    delete sem[campo]
    assert.equal(cadastroSchema.safeParse(sem).success, false, campo)
  }
  for (const extra of [{ role: 'admin' }, { user_id: 'x' }, { email_confirmado: true }]) {
    assert.equal(cadastroSchema.safeParse({ ...base, ...extra }).success, false)
  }
})

test('reenvio de confirmação exige só um e-mail válido', () => {
  assert.equal(reenviarConfirmacaoSchema.safeParse({ email: 'ana@exemplo.com' }).success, true)
  assert.equal(reenviarConfirmacaoSchema.safeParse({ email: 'ana' }).success, false)
  assert.equal(reenviarConfirmacaoSchema.safeParse({}).success, false)
  assert.equal(
    reenviarConfirmacaoSchema.safeParse({ email: 'ana@exemplo.com', password: 'x' }).success,
    false,
  )
})

test('traduz os erros do Supabase Auth', () => {
  const casos: [{ code?: string; status?: number }, number, string][] = [
    [{ code: 'user_already_exists', status: 422 }, 409, 'email_ja_cadastrado'],
    [{ code: 'weak_password', status: 422 }, 422, 'senha_fraca'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 429, 'muitas_tentativas'],
    [{ code: 'over_request_rate_limit', status: 429 }, 429, 'muitas_tentativas'],
    [{ code: 'email_address_invalid', status: 400 }, 422, 'dados_invalidos'],
    [{ code: 'signup_disabled', status: 422 }, 403, 'cadastro_desativado'],
    [{ status: 0 }, 503, 'servico_indisponivel'],
    [{ status: 500 }, 503, 'servico_indisponivel'],
    [{ code: 'qualquer_outro', status: 400 }, 422, 'dados_invalidos'],
  ]
  for (const [erro, status, codigo] of casos) {
    const r = traduzirErroCadastro(erro)
    assert.equal(r.status, status, JSON.stringify(erro))
    assert.equal(r.corpo.erro, codigo, JSON.stringify(erro))
    assert.ok(r.corpo.mensagem.length > 0)
  }
})

test('limitador: bloqueia depois do máximo, libera depois da janela e separa as chaves', () => {
  const permitir = criarLimitador(3, 1000)
  assert.equal(permitir('a', 0), true)
  assert.equal(permitir('a', 100), true)
  assert.equal(permitir('a', 200), true)
  assert.equal(permitir('a', 300), false)
  assert.equal(permitir('b', 300), true)
  assert.equal(permitir('a', 1100), true)
})
