// A mesma tentativa, com o mesmo payload, conserva a chave em caso de resposta perdida.
// Sucesso ou mudança dos dados inicia outra tentativa lógica; não há cálculo financeiro aqui.
export function criarTentativaIdempotente() {
  let assinatura: string | undefined
  let chave = ''
  return {
    chavePara(payload: unknown): string {
      const atual = JSON.stringify(payload)
      if (atual !== assinatura) {
        assinatura = atual
        const bytes = crypto.getRandomValues(new Uint8Array(16))
        chave = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      }
      return chave
    },
    concluir() {
      assinatura = undefined
      chave = ''
    },
  }
}
