import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { chaveTema, lerTema, useTemaStore } from '../src/stores/tema.ts'
import { useNotificacoesStore } from '../src/stores/notificacoes.ts'

test('tema usa escuro por padrão, restaura claro e alterna sem toast de sucesso', () => {
  const dados = new Map<string, string>()
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const dom = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (chave: string) => dados.get(chave) ?? null,
      setItem: (chave: string, valor: string) => dados.set(chave, valor),
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { documentElement: { dataset: {} as Record<string, string> } },
  })
  try {
    assert.equal(lerTema(), 'dark')
    dados.set(chaveTema, 'inválido')
    assert.equal(lerTema(), 'dark')
    dados.set(chaveTema, 'light')
    setActivePinia(createPinia())
    const tema = useTemaStore()
    assert.equal(tema.atual, 'light')
    tema.alternar()
    assert.equal(tema.atual, 'dark')
    assert.equal(document.documentElement.dataset.theme, 'dark')
    assert.equal(lerTema(), 'dark')
    assert.equal(useNotificacoesStore().itens.length, 0)
    tema.alternar()
    assert.equal(lerTema(), 'light')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('bloqueado')
        },
        setItem: () => {
          throw new Error('bloqueado')
        },
      },
    })
    assert.equal(lerTema(), 'dark')
    tema.alternar()
    assert.equal(document.documentElement.dataset.theme, 'dark')
    assert.ok(tema.erroPersistencia)
    assert.equal(useNotificacoesStore().itens[0]?.tipo, 'erro')
  } finally {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage)
    else Reflect.deleteProperty(globalThis, 'localStorage')
    if (dom) Object.defineProperty(globalThis, 'document', dom)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
