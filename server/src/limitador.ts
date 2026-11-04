// Limitador simples de tentativas por chave (normalmente o IP), em memória.
// Protege as rotas públicas (cadastro e reenvio de confirmação) contra abuso e contra
// "bombardeio" de e-mails. É por instância do servidor: reiniciar zera a contagem.
export function criarLimitador(max: number, janelaMs: number) {
  const tentativas = new Map<string, number[]>()

  // Devolve true se a tentativa é permitida (e a registra); false se passou do limite.
  return function permitir(chave: string, agora: number = Date.now()): boolean {
    const recentes = (tentativas.get(chave) ?? []).filter((t) => agora - t < janelaMs)
    if (recentes.length >= max) {
      tentativas.set(chave, recentes)
      return false
    }
    recentes.push(agora)
    tentativas.set(chave, recentes)

    // Limpeza ocasional para a memória não crescer sem limite.
    if (tentativas.size > 5000) {
      for (const [k, lista] of tentativas) {
        if (lista.every((t) => agora - t >= janelaMs)) tentativas.delete(k)
      }
    }
    return true
  }
}
