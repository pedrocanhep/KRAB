import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listarAtividades, ordenarAtividades, type Atividade } from '../src/services/atividades.ts'

const receita = (id: string, created_at: string): Atividade => ({
  tipo: 'receita',
  id,
  descricao: 'Serviço',
  valor: 10,
  created_at,
})

test('ordena por criação, preserva microssegundos e normaliza fuso', () => {
  const itens = ordenarAtividades([
    receita('antiga', '2026-10-17T10:00:00.123001Z'),
    receita('nova', '2026-10-17T07:00:00.123999-03:00'),
    receita('anterior', '2026-10-16T23:00:00Z'),
  ])
  assert.deepEqual(
    itens.map((item) => item.id),
    ['nova', 'antiga', 'anterior'],
  )
})

test('limita globalmente a oito e mantém desempate estável sem modificar a entrada', () => {
  const itens = Array.from({ length: 12 }, (_, i) =>
    receita(String(i).padStart(2, '0'), '2026-10-17T10:00:00Z'),
  )
  const resultado = ordenarAtividades(itens)
  assert.equal(resultado.length, 8)
  assert.deepEqual(
    resultado.map((item) => item.id),
    ['11', '10', '09', '08', '07', '06', '05', '04'],
  )
  assert.equal(itens[0]?.id, '00')
})

// Simula apenas a fronteira do Supabase: verifica os filtros e a ordenação
// enviados ao banco sem acessar rede, configurações locais ou credenciais.
function bancoSimulado(falhar = false) {
  const chamadas: { tabela: string; metodo: string; argumentos: unknown[] }[] = []
  const registros: Record<string, unknown[]> = {
    receita: [{ id: 'r', descricao: 'Venda', valor: 20, created_at: '2026-10-17T10:00:00Z' }],
    despesa: [
      {
        id: 'd',
        descricao: 'Água',
        valor: 10,
        status: 'pendente',
        created_at: '2026-10-17T11:00:00Z',
      },
      { id: 'p', descricao: 'Luz', valor: 15, status: 'paga', created_at: '2026-10-17T09:00:00Z' },
    ],
    conta: [{ id: 'c', nome: 'Caixa', created_at: '2026-10-17T12:00:00Z' }],
  }
  const db = {
    from(tabela: string) {
      const builder = {
        select(...args: unknown[]) {
          registrar('select', args)
          return builder
        },
        is(...args: unknown[]) {
          registrar('is', args)
          return builder
        },
        order(...args: unknown[]) {
          registrar('order', args)
          return builder
        },
        limit(...args: unknown[]) {
          registrar('limit', args)
          return builder
        },
        returns() {
          return Promise.resolve(
            falhar && tabela === 'despesa'
              ? { data: null, error: { message: 'falha simulada', code: 'XX000' } }
              : { data: registros[tabela], error: null },
          )
        },
      }
      function registrar(metodo: string, argumentos: unknown[]) {
        chamadas.push({ tabela, metodo, argumentos })
      }
      return builder
    },
  }
  // O mock implementa somente os métodos usados pelo serviço, não o SDK inteiro.
  return { db: db as unknown as Pick<SupabaseClient, 'from'>, chamadas }
}

test('unifica os três tipos, inclui pendente/paga e não atribui valor à conta', async () => {
  const { db, chamadas } = bancoSimulado()
  const resultado = await listarAtividades(db)
  assert.equal(resultado.error, null)
  assert.deepEqual(
    resultado.itens.map((item) => item.id),
    ['c', 'd', 'r', 'p'],
  )
  assert.deepEqual(resultado.itens[0], {
    tipo: 'conta',
    id: 'c',
    nome: 'Caixa',
    created_at: '2026-10-17T12:00:00Z',
  })
  assert.equal('valor' in resultado.itens[0]!, false)
  for (const tabela of ['receita', 'despesa', 'conta']) {
    const consulta = chamadas.filter((item) => item.tabela === tabela)
    assert.deepEqual(consulta.find((item) => item.metodo === 'is')?.argumentos, [
      'deleted_at',
      null,
    ])
    assert.deepEqual(
      consulta.filter((item) => item.metodo === 'order').map((item) => item.argumentos),
      [
        ['created_at', { ascending: false }],
        ['id', { ascending: false }],
      ],
    )
    assert.deepEqual(consulta.find((item) => item.metodo === 'limit')?.argumentos, [8])
  }
  assert.deepEqual(
    chamadas.find((item) => item.tabela === 'conta' && item.metodo === 'select')?.argumentos,
    ['id, nome, created_at'],
  )
})

test('não apresenta uma lista parcial quando uma consulta falha', async () => {
  const { db } = bancoSimulado(true)
  const resultado = await listarAtividades(db)
  assert.equal(resultado.error?.message, 'falha simulada')
  assert.deepEqual(resultado.itens, [])
})

test('lista vazia é válida', () => {
  assert.deepEqual(ordenarAtividades([]), [])
})
