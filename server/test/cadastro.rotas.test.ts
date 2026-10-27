import { after, test } from 'node:test'
import assert from 'node:assert/strict'

// A config lê estas variáveis ao ser importada, então elas vêm ANTES dos imports dinâmicos.
process.env.SUPABASE_URL = 'http://supabase.teste'
process.env.SUPABASE_ANON_KEY = 'chave-anon-de-teste'
process.env.CORS_ORIGIN = 'http://localhost:5173'

const { buildApp } = await import('../src/app.ts')
const app = buildApp()
after(() => app.close())

// Substitui o fetch: nenhuma chamada real ao Supabase. Guarda o que o servidor tentou enviar.
const chamadas: { url: string; corpo: Record<string, unknown> | null }[] = []
function simular(status: number, corpo: unknown) {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), corpo: init?.body ? JSON.parse(String(init.body)) : null })
    return new Response(JSON.stringify(corpo), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}
function simularFalhaDeRede() {
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed')
  }) as typeof fetch
}

const dados = {
  nome: 'Ana Souza',
  email: ' Ana@Exemplo.com ',
  password: 'senha1234',
  confirmar_senha: 'senha1234',
}
let contadorIp = 0
const novoIp = () => `10.0.0.${++contadorIp}`
const cadastrar = (payload: unknown, ip = novoIp()) =>
  app.inject({
    method: 'POST',
    url: '/auth/cadastro',
    payload: payload as object,
    remoteAddress: ip,
  })

test('cadastro com confirmação de e-mail pendente: 201, sem token, dados normalizados', async () => {
  chamadas.length = 0
  simular(200, { id: 'u1', aud: 'authenticated', email: 'ana@exemplo.com', identities: [{}] })
  const r = await cadastrar(dados)
  assert.equal(r.statusCode, 201)
  const corpo = r.json()
  assert.equal(corpo.confirmacao_pendente, true)
  assert.match(corpo.mensagem, /confirm/i)
  assert.equal(r.headers['cache-control'], 'no-store')

  assert.equal(chamadas.length, 1)
  assert.match(chamadas[0]?.url ?? '', /\/auth\/v1\/signup/)
  assert.match(chamadas[0]?.url ?? '', /redirect_to=/)
  assert.equal(chamadas[0]?.corpo?.email, 'ana@exemplo.com')
  assert.deepEqual(chamadas[0]?.corpo?.data, { nome: 'Ana Souza' })
})

test('cadastro com sessão (confirmação desligada): 201 e NENHUM token na resposta', async () => {
  simular(200, {
    access_token: 'token-secreto',
    refresh_token: 'refresh-secreto',
    token_type: 'bearer',
    expires_in: 3600,
    user: { id: 'u2', email: 'ana@exemplo.com' },
  })
  const r = await cadastrar(dados)
  assert.equal(r.statusCode, 201)
  assert.equal(r.json().confirmacao_pendente, false)
  assert.doesNotMatch(r.body, /token-secreto|refresh-secreto|access_token|refresh_token/)
})

test('e-mail já cadastrado vira 409', async () => {
  simular(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' })
  const r = await cadastrar(dados)
  assert.equal(r.statusCode, 409)
  assert.equal(r.json().erro, 'email_ja_cadastrado')
})

test('senha fraca segundo o Supabase vira 422 senha_fraca', async () => {
  simular(422, {
    code: 422,
    error_code: 'weak_password',
    msg: 'Password should be at least 8 characters.',
    weak_password: { reasons: ['length'] },
  })
  const r = await cadastrar(dados)
  assert.equal(r.statusCode, 422)
  assert.equal(r.json().erro, 'senha_fraca')
})

test('limite de e-mails do Supabase vira 429', async () => {
  simular(429, {
    code: 429,
    error_code: 'over_email_send_rate_limit',
    msg: 'email rate limit exceeded',
  })
  const r = await cadastrar(dados)
  assert.equal(r.statusCode, 429)
  assert.equal(r.json().erro, 'muitas_tentativas')
})

test('Supabase fora do ar vira 503, sem vazar detalhes', async () => {
  simularFalhaDeRede()
  const r = await cadastrar(dados)
  assert.equal(r.statusCode, 503)
  assert.equal(r.json().erro, 'servico_indisponivel')
  assert.doesNotMatch(r.body, /fetch failed|supabase\.teste/)
})

test('dados inválidos são barrados ANTES de falar com o Supabase', async () => {
  chamadas.length = 0
  simular(200, {})
  const casos = [
    { ...dados, confirmar_senha: 'diferente' },
    { ...dados, password: '1234567', confirmar_senha: '1234567' },
    { ...dados, email: 'sem-arroba' },
    { ...dados, nome: '   ' },
    { ...dados, role: 'admin' },
  ]
  for (const caso of casos) {
    const r = await cadastrar(caso)
    assert.equal(r.statusCode, 422, JSON.stringify(caso))
    assert.equal(r.json().erro, 'dados_invalidos')
  }
  assert.equal(chamadas.length, 0)
})

test('a senha nunca aparece em respostas de erro', async () => {
  simular(200, {})
  const r = await cadastrar({ ...dados, password: 'SenhaMuitoSecreta', confirmar_senha: 'outra' })
  assert.equal(r.statusCode, 422)
  assert.doesNotMatch(r.body, /SenhaMuitoSecreta/)
})

test('o sexto cadastro do mesmo IP em 15 minutos é bloqueado com 429', async () => {
  chamadas.length = 0
  simular(200, { id: 'u', email: 'ana@exemplo.com', identities: [{}] })
  const ip = novoIp()
  for (let i = 0; i < 5; i++) {
    assert.equal((await cadastrar(dados, ip)).statusCode, 201)
  }
  const bloqueada = await cadastrar(dados, ip)
  assert.equal(bloqueada.statusCode, 429)
  assert.equal(chamadas.length, 5)
})

test('reenvio de confirmação: resposta sempre igual e com o tipo "signup"', async () => {
  chamadas.length = 0
  simular(200, {})
  const ok = await app.inject({
    method: 'POST',
    url: '/auth/reenviar-confirmacao',
    payload: { email: 'Ana@Exemplo.com' },
    remoteAddress: novoIp(),
  })
  assert.equal(ok.statusCode, 200)
  assert.match(chamadas[0]?.url ?? '', /\/auth\/v1\/resend/)
  assert.equal(chamadas[0]?.corpo?.type, 'signup')
  assert.equal(chamadas[0]?.corpo?.email, 'ana@exemplo.com')

  // E-mail sem cadastro ou já confirmado: mesma resposta, para não revelar quem está cadastrado.
  simular(400, { code: 400, error_code: 'validation_failed', msg: 'qualquer erro' })
  const igual = await app.inject({
    method: 'POST',
    url: '/auth/reenviar-confirmacao',
    payload: { email: 'naoexiste@exemplo.com' },
    remoteAddress: novoIp(),
  })
  assert.equal(igual.statusCode, 200)
  assert.equal(igual.json().mensagem, ok.json().mensagem)

  const invalido = await app.inject({
    method: 'POST',
    url: '/auth/reenviar-confirmacao',
    payload: { email: 'invalido' },
    remoteAddress: novoIp(),
  })
  assert.equal(invalido.statusCode, 422)
})

test('as rotas de cadastro são públicas, mas o resto continua exigindo token', async () => {
  const r = await app.inject({ method: 'GET', url: '/contas', remoteAddress: novoIp() })
  assert.equal(r.statusCode, 401)
})
