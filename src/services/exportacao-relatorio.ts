import { obterExtrato, type Extrato, type Relatorio } from './relatorios'
import { dataFinanceira, moeda } from './dashboard'

// A exportação possui paginação própria e nunca altera a consulta visível.
export async function consultarExtratoCompleto(filtros: URLSearchParams, token: string) {
  const query = new URLSearchParams(filtros)
  query.set('limit', '500')
  const itens: Extrato['itens'] = []
  const ids = new Set<string>()
  let primeira: Extrato | undefined
  for (let pagina = 0; pagina < 100; pagina++) {
    query.set('offset', String(itens.length))
    const dados = await obterExtrato(query, token)
    primeira ??= dados
    if (
      dados.totais.quantidade !== primeira.totais.quantidade ||
      JSON.stringify(dados.totais) !== JSON.stringify(primeira.totais)
    )
      throw new Error(
        'Os dados mudaram durante a exportação. Aplique os filtros e tente novamente.',
      )
    for (const item of dados.itens) {
      const chave = `${item.tipo}-${item.id}`
      if (ids.has(chave))
        throw new Error('A paginação retornou registros repetidos. Tente novamente.')
      ids.add(chave)
      itens.push(item)
    }
    if (itens.length === primeira.totais.quantidade) return { ...primeira, itens }
    if (!dados.itens.length || itens.length > primeira.totais.quantidade) break
  }
  throw new Error(
    'Não foi possível obter todos os registros com segurança. Reduza o período e tente novamente.',
  )
}
const escapar = (valor: unknown) =>
  String(valor).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
const estiloImpressao = `  @page{size:A4 landscape;margin:16mm}body{font:12px Arial,sans-serif;color:#172c24;background:white;margin:24px}h1{color:#087c55;font-size:26px}h2{font-size:20px}.summary{display:flex;gap:24px;flex-wrap:wrap;padding:16px;background:#eff6f2;margin:20px 0}.summary div{line-height:1.8}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #ccd8d1;overflow-wrap:anywhere}th{background:#eff6f2}thead{display:table-header-group}tr{break-inside:avoid}td:last-child{white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}.despesa{color:#a52b36}.print-footer{font-size:10px;color:#52675c;text-align:left!important;border-bottom:0}tfoot{display:table-footer-group}button{padding:12px;background:#087c55;color:white;border:0;border-radius:6px;cursor:pointer}@media print{body{margin:0}button,.instructions{display:none}}`

export function documentoRelatorio(
  titulo: string,
  conta: string,
  extrato: Extrato,
  resumo: Relatorio | null,
  nome: string,
) {
  const linha = (rotulo: string, valor: string | number) =>
    `<div><b>${escapar(rotulo)}</b><br>${escapar(valor)}</div>`
  const totais = resumo
    ? linha('Total', moeda(resumo.total)) +
      linha('Registros', resumo.quantidade) +
      (resumo.a_pagar
        ? linha('A pagar por vencimento', moeda(resumo.a_pagar.total)) +
          linha('Despesas pendentes', resumo.a_pagar.quantidade)
        : '')
    : linha('Entradas', moeda(extrato.totais.entradas)) +
      linha('Saídas', moeda(extrato.totais.saidas)) +
      linha('Resultado do período', moeda(extrato.totais.saldo_periodo)) +
      linha('Saldo atual', moeda(extrato.saldo_atual)) +
      linha('Registros', extrato.totais.quantidade)
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(nome)}</title><style>${estiloImpressao}</style></head><body>
  <button onclick="window.print()">Imprimir / Salvar como PDF</button><p class="instructions">Selecione “Salvar como PDF” na impressão. Nome sugerido: ${escapar(nome)}.pdf</p>
  <h1>KRAB</h1><h2>${escapar(titulo)}</h2><p>Período: ${escapar(dataFinanceira(extrato.periodo.de))} a ${escapar(dataFinanceira(extrato.periodo.ate))}<br>Conta: ${escapar(conta)}<br>Gerado em: ${escapar(new Date().toLocaleString('pt-BR'))}</p>
  <div class="summary">${totais}</div>
  ${resumo?.categorias.length ? `<h3>Totais por categoria</h3><table><thead><tr><th>Categoria</th><th>Quantidade</th><th>Participação</th><th>Total</th></tr></thead><tbody>${resumo.categorias.map((c) => `<tr><td>${escapar(c.categoria)}</td><td>${c.quantidade}</td><td>${escapar(c.percentual.toLocaleString('pt-BR'))}%</td><td>${escapar(moeda(c.total))}</td></tr>`).join('')}</tbody></table>` : ''}
  <h3>Movimentações efetivadas</h3><table><thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Categoria</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>${extrato.itens.map((i) => `<tr><td>${escapar(dataFinanceira(i.data))}</td><td>${escapar(i.descricao)}</td><td>${escapar(i.conta_nome)}</td><td>${escapar(i.categoria)}</td><td>${i.tipo === 'receita' ? 'Receita' : 'Despesa paga'}</td><td class="${i.tipo === 'receita' ? 'receita' : 'despesa'}">${escapar(moeda(i.valor))}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="6" class="print-footer">Documento gerado pelo KRAB.</td></tr></tfoot></table>${!extrato.itens.length ? '<p>Nenhum registro encontrado para os filtros aplicados.</p>' : ''}</body></html>`
}

// Listagens usam o limite de 100 aceito pelos três cadastros.
export async function consultarListagemCompleta<T extends { id: string }>(
  buscar: (offset: number) => Promise<{ itens: T[]; total: number }>,
): Promise<T[]> {
  const itens: T[] = []
  const ids = new Set<string>()
  let total: number | undefined
  for (let pagina = 0; pagina < 100; pagina++) {
    const dados = await buscar(itens.length)
    total ??= dados.total
    if (!Number.isSafeInteger(total) || total < 0 || dados.total !== total)
      throw new Error('A listagem mudou durante a exportação. Tente novamente.')
    for (const item of dados.itens) {
      if (ids.has(item.id))
        throw new Error('A paginação retornou registros repetidos. Tente novamente.')
      ids.add(item.id)
      itens.push(item)
    }
    if (itens.length === total) return itens
    if (!dados.itens.length || itens.length > total) break
  }
  throw new Error(
    'Não foi possível obter todos os registros com segurança. Refine os filtros e tente novamente.',
  )
}

export function abrirImpressao() {
  const janela = window.open('', '_blank')
  if (!janela) throw new Error('Permita abrir a janela de impressão para salvar o PDF.')
  janela.document.body.textContent = 'Preparando documento completo…'
  return janela
}

export function imprimirDocumento(janela: Window, html: string) {
  if (janela.closed) throw new Error('A janela de impressão foi fechada. Tente novamente.')
  janela.document.open()
  janela.document.write(html)
  janela.document.close()
  janela.focus()
  janela.print()
}

export function documentoListagem(
  titulo: string,
  nome: string,
  filtros: [string, string][],
  colunas: string[],
  linhas: string[][],
) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(nome)}</title><style>${estiloImpressao}td:last-child{text-align:left;white-space:normal}td.money{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}</style></head><body>
  <button onclick="window.print()">Imprimir / Salvar como PDF</button><p class="instructions">Selecione “Salvar como PDF”. Nome sugerido: ${escapar(nome)}.pdf</p>
  <h1>KRAB</h1><h2>${escapar(titulo)}</h2>
  <p>${filtros.map(([label, valor]) => `${escapar(label)}: ${escapar(valor)}`).join('<br>')}<br>Gerado em: ${escapar(new Date().toLocaleString('pt-BR'))}</p>
  <table><thead><tr>${colunas.map((c) => `<th scope="col">${escapar(c)}</th>`).join('')}</tr></thead><tbody>${linhas.map((linha) => `<tr>${linha.map((valor, i) => `<td${colunas[i]?.includes('Valor') || colunas[i]?.includes('Saldo') ? ' class="money"' : ''}>${escapar(valor)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><td colspan="${colunas.length}" class="print-footer">Documento gerado pelo KRAB.</td></tr></tfoot></table>
  ${!linhas.length ? '<p>Nenhum registro encontrado para os filtros aplicados.</p>' : ''}</body></html>`
}
