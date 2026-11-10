import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import {
  chavePreferencias,
  lerPreferencias,
  usePreferenciasStore,
} from '../src/stores/preferencias.ts'

test('preferências validam dados salvos, persistem e restauram todas as opções', () => {
  const dados = new Map<string, string>()
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (chave: string) => dados.get(chave) ?? null,
      setItem: (chave: string, valor: string) => dados.set(chave, valor),
    },
  })
  try {
    dados.set(chavePreferencias, '{inválido')
    assert.equal(lerPreferencias().alertas, true)
    dados.set(
      chavePreferencias,
      JSON.stringify({ alertas: false, resumo: 'false', desconhecida: true }),
    )
    assert.deepEqual(lerPreferencias(), {
      alertas: false,
      resumo: true,
      atividades: true,
      atalhos: true,
      menuFlutuante: true,
      notificacoes: true,
    })
    setActivePinia(createPinia())
    const store = usePreferenciasStore()
    store.visualizacao.atividades = false
    assert.equal(lerPreferencias().atividades, false)
    store.restaurar()
    assert.equal(Object.values(lerPreferencias()).every(Boolean), true)
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('Bloqueado')
        },
        setItem: () => {
          throw new Error('Bloqueado')
        },
      },
    })
    assert.equal(lerPreferencias().alertas, true)
    store.visualizacao.alertas = false
    assert.ok(store.erroPersistencia)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
