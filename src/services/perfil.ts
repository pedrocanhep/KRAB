import { requisitar } from './http'

export interface Perfil {
  nome: string | null
}

export function obterPerfil(token: string): Promise<Perfil> {
  return requisitar<Perfil>('/perfil', token)
}

export function salvarPerfil(nome: string, token: string): Promise<Perfil> {
  return requisitar<Perfil>('/perfil', token, { nome }, 'PUT')
}
