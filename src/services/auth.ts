interface SessaoLogin {
  access_token: string
  expires_at: number
}

// E-mail e senha são enviados apenas ao endpoint de login, sem logs ou persistência.
export async function fazerLogin(
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<SessaoLogin> {
  const resposta = await fetch('http://localhost:3333/auth/login', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!resposta.ok) {
    if (resposta.status === 401) {
      throw new Error('E-mail ou senha inválidos, ou usuário não confirmado.')
    }
    if (resposta.status === 422) {
      throw new Error('Informe um e-mail válido e preencha a senha.')
    }
    if (resposta.status === 429)
      throw new Error('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
    throw new Error('O serviço está indisponível no momento. Tente novamente em instantes.')
  }
  const sessao = (await resposta.json().catch(() => null)) as SessaoLogin | null
  if (
    !sessao ||
    typeof sessao.access_token !== 'string' ||
    !sessao.access_token ||
    typeof sessao.expires_at !== 'number' ||
    !Number.isFinite(sessao.expires_at)
  ) {
    throw new Error('Não foi possível confirmar o acesso. Tente novamente.')
  }
  return sessao
}
