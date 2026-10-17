interface SessaoLogin {
  access_token: string
  expires_at: number
}

// E-mail e senha são enviados apenas ao endpoint de login, sem logs ou persistência.
export async function fazerLogin(email: string, password: string): Promise<SessaoLogin> {
  const resposta = await fetch('http://localhost:3333/auth/login', {
    method: 'POST',
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
    throw new Error('Não foi possível realizar o login. Tente novamente.')
  }
  return (await resposta.json()) as SessaoLogin
}
