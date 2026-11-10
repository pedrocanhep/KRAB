import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fazerLogin } from '../src/services/auth.ts'
import { cadastrarUsuario, reenviarConfirmacao } from '../src/services/cadastro.ts'

const dados = {
  nome: 'Ana',
  email: 'ana@example.invalid',
  password: ' senha1234 ',
  confirmar_senha: ' senha1234 ',
}

test('login preserva a senha exata e aceita cancelamento sem alterar o contrato', async (t) => {
  const controlador = new AbortController()
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.signal, controlador.signal)
    assert.deepEqual(JSON.parse(String(init?.body)), {
      email: dados.email,
      password: dados.password,
    })
    return Response.json({ access_token: 'token-de-teste', expires_at: 2000000000 })
  })
  assert.deepEqual(await fazerLogin(dados.email, dados.password, controlador.signal), {
    access_token: 'token-de-teste',
    expires_at: 2000000000,
  })
})

test('login não exibe corpo técnico nem aceita sessão incompleta', async (t) => {
  const mock = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('internal debug trace', { status: 503 }),
  )
  await assert.rejects(fazerLogin(dados.email, dados.password), /serviço está indisponível/)
  mock.mock.mockImplementation(async () => new Response('not-json'))
  await assert.rejects(
    fazerLogin(dados.email, dados.password),
    /Não foi possível confirmar o acesso/,
  )
  mock.mock.mockImplementation(async () => Response.json({ access_token: 'token-de-teste' }))
  await assert.rejects(
    fazerLogin(dados.email, dados.password),
    /Não foi possível confirmar o acesso/,
  )
})

test('cadastro mantém confirmação pendente e não cria uma sessão artificial', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { mensagem: 'Confirme seu e-mail.', confirmacao_pendente: true },
      { status: 201 },
    ),
  )
  assert.deepEqual(await cadastrarUsuario(dados), {
    mensagem: 'Confirme seu e-mail.',
    confirmacao_pendente: true,
  })
})

test('cadastro traduz duplicidade e limite sem exibir detalhes internos', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { erro: 'email_ja_cadastrado', mensagem: 'internal debug trace' },
      { status: 409 },
    ),
  )
  await assert.rejects(cadastrarUsuario(dados), /Já existe um cadastro com este e-mail/)
  mock.mock.mockImplementation(async () =>
    Response.json({ mensagem: 'internal debug trace' }, { status: 429 }),
  )
  await assert.rejects(cadastrarUsuario(dados), /Muitas tentativas/)
  mock.mock.mockImplementation(async () =>
    Response.json({ mensagem: 'internal debug trace' }, { status: 500 }),
  )
  await assert.rejects(cadastrarUsuario(dados), /serviço está indisponível/)
})

test('cadastro não confirma sucesso para resposta inválida', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ mensagem: 'Cadastro recebido' }))
  await assert.rejects(
    cadastrarUsuario(dados),
    /Não foi possível confirmar o resultado do cadastro/,
  )
})

test('reenvio preserva mensagem genérica e trata resposta inválida de forma legível', async (t) => {
  const mensagem = 'Se existir um cadastro aguardando confirmação, enviamos um novo link.'
  const mock = t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { email: dados.email })
    return Response.json({ mensagem })
  })
  assert.equal(await reenviarConfirmacao(dados.email), mensagem)
  mock.mock.mockImplementation(async () => new Response('invalid json'))
  await assert.rejects(reenviarConfirmacao(dados.email), /Não foi possível confirmar o reenvio/)
})
