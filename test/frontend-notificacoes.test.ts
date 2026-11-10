import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useNotificacoesStore } from '../src/stores/notificacoes.ts'

function criarStore() {
  setActivePinia(createPinia())
  return useNotificacoesStore()
}

test('notificações aceitam os quatro tipos, limitam a pilha e podem ser fechadas', () => {
  const store = criarStore()
  const ids = (['sucesso', 'erro', 'aviso', 'informacao'] as const).map((tipo) =>
    store.adicionar({ tipo, titulo: tipo, mensagem: 'Mensagem de teste', duracao: 0 }),
  )
  assert.equal(store.itens.length, 4)
  const nova = store.adicionar({
    tipo: 'informacao',
    titulo: 'Outra',
    mensagem: 'Outra mensagem',
    duracao: 0,
  })
  assert.equal(store.itens.length, 4)
  assert.equal(
    store.itens.some((item) => item.id === ids[0]),
    false,
  )
  store.remover(nova)
  assert.equal(store.itens.length, 3)
})

test('erros e avisos permanecem até o usuário fechar', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
  const store = criarStore()
  const erro = store.adicionar({ tipo: 'erro', titulo: 'Erro', mensagem: 'Tente novamente.' })
  const aviso = store.adicionar({ tipo: 'aviso', titulo: 'Aviso', mensagem: 'Confira os dados.' })
  t.mock.timers.tick(60 * 60 * 1000)
  assert.equal(store.itens.length, 2)
  store.remover(erro)
  store.remover(aviso)
  assert.equal(store.itens.length, 0)
})

test('tempo de leitura pausa e retoma sem descartar antes do prazo restante', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
  const store = criarStore()
  const id = store.adicionar({
    tipo: 'sucesso',
    titulo: 'Concluído',
    mensagem: 'Salvo.',
    duracao: 1000,
  })
  t.mock.timers.tick(400)
  store.pausar(id)
  t.mock.timers.tick(10000)
  assert.equal(store.itens.length, 1)
  store.retomar(id)
  t.mock.timers.tick(599)
  assert.equal(store.itens.length, 1)
  t.mock.timers.tick(1)
  assert.equal(store.itens.length, 0)
})

test('fechar uma notificação também cancela seu temporizador', (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 })
  const store = criarStore()
  const id = store.adicionar({
    tipo: 'informacao',
    titulo: 'Informação',
    mensagem: 'Detalhes.',
    duracao: 100,
  })
  store.remover(id)
  t.mock.timers.tick(1000)
  assert.equal(store.itens.length, 0)
  store.pausar(id)
  store.retomar(id)
  assert.equal(store.itens.length, 0)
})

test('novo feedback de autenticação substitui o anterior sem acumular mensagens antigas', () => {
  const store = criarStore()
  const antigo = store.adicionar({
    tipo: 'informacao',
    grupo: 'autenticacao',
    titulo: 'Cadastro',
    mensagem: 'Confirme seu e-mail.',
    duracao: 0,
  })
  const sessao = store.adicionar({
    tipo: 'aviso',
    grupo: 'sessao',
    titulo: 'Sessão',
    mensagem: 'Entre novamente.',
  })
  store.adicionar({
    tipo: 'erro',
    grupo: 'autenticacao',
    titulo: 'Reenvio',
    mensagem: 'Aguarde e tente novamente.',
  })
  assert.equal(store.itens.length, 2)
  assert.equal(
    store.itens.some((item) => item.id === antigo),
    false,
  )
  assert.equal(
    store.itens.some((item) => item.id === sessao),
    true,
  )
})
