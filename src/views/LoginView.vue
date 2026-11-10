<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthLayout from '../components/auth/AuthLayout.vue'
import CampoSenha from '../components/auth/CampoSenha.vue'
import { fazerLogin } from '../services/auth'
import { useAuthStore } from '../stores/auth'
import { useNotificacoesStore } from '../stores/notificacoes'

const email = ref('')
const senha = ref('')
const entrando = ref(false)
const erros = reactive({ email: '', senha: '' })
const formulario = ref<HTMLFormElement>()
const auth = useAuthStore()
const router = useRouter()
const notificacoes = useNotificacoesStore()
let erroId: number | undefined
let controlador: AbortController | undefined
let ativo = true
function validar(campo: 'email' | 'senha') {
  if (campo === 'email')
    erros.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())
      ? ''
      : 'Informe um e-mail válido.'
  else erros.senha = senha.value.length ? '' : 'Digite sua senha.'
}
function limparErro() {
  if (erroId !== undefined) notificacoes.remover(erroId)
  erroId = undefined
}
function editar(campo: 'email' | 'senha') {
  limparErro()
  if (erros[campo]) validar(campo)
}
async function entrar() {
  if (entrando.value) return
  limparErro()
  validar('email')
  validar('senha')
  if (erros.email || erros.senha) {
    erroId = notificacoes.adicionar({
      grupo: 'autenticacao',
      tipo: 'aviso',
      titulo: 'Confira seus dados',
      mensagem: 'Preencha os campos destacados para entrar.',
    })
    await nextTick()
    formulario.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  entrando.value = true
  controlador = new AbortController()
  try {
    const sessao = await fazerLogin(email.value.trim(), senha.value, controlador.signal)
    if (!ativo) return
    auth.definirSessao(sessao.access_token, sessao.expires_at)
    senha.value = ''
    notificacoes.adicionar({
      grupo: 'autenticacao',
      tipo: 'sucesso',
      titulo: 'Bem-vindo ao KRAB',
      mensagem: 'Você entrou na sua conta.',
    })
    await router.push('/')
  } catch (falha) {
    if (!ativo || (falha instanceof Error && falha.name === 'AbortError')) return
    erroId = notificacoes.adicionar({
      grupo: 'autenticacao',
      tipo: 'erro',
      titulo: 'Não foi possível entrar',
      mensagem:
        falha instanceof TypeError
          ? 'Não foi possível conectar ao sistema. Confira sua conexão e tente novamente.'
          : falha instanceof Error
            ? falha.message
            : 'Tente novamente em instantes.',
    })
  } finally {
    if (ativo) entrando.value = false
  }
}
onBeforeUnmount(() => {
  ativo = false
  controlador?.abort()
  senha.value = ''
  limparErro()
})
</script>
<template>
  <AuthLayout titulo="ENTRAR" descricao="" etapa="ACESSAR SUA CONTA" google>
    <form
      ref="formulario"
      class="auth-form"
      novalidate
      :aria-busy="entrando"
      @submit.prevent="entrar"
    >
      <fieldset :disabled="entrando">
        <div class="auth-field" :class="{ 'has-error': erros.email }">
          <label for="email">E-mail</label
          ><input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            inputmode="email"
            autocapitalize="none"
            spellcheck="false"
            placeholder="voce@exemplo.com"
            maxlength="254"
            required
            :aria-invalid="Boolean(erros.email)"
            :aria-describedby="erros.email ? 'email-erro' : undefined"
            @blur="validar('email')"
            @input="editar('email')"
          />
          <p v-if="erros.email" id="email-erro" class="auth-field-error">{{ erros.email }}</p>
        </div>
        <CampoSenha
          id="senha"
          v-model="senha"
          label="Senha"
          :erro="erros.senha"
          @blur="validar('senha')"
          @editar="editar('senha')"
        />
        <button class="auth-primary" type="submit" :disabled="entrando" :aria-busy="entrando">
          <span v-if="entrando" class="auth-spinner" aria-hidden="true"></span
          >{{ entrando ? 'Entrando…' : 'Entrar na minha conta'
          }}<svg
            v-if="!entrando"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14m-5-5 5 5-5 5" />
          </svg>
        </button>
      </fieldset>
    </form>
    <div class="auth-link-row">
      <RouterLink class="auth-link" to="/cadastro?confirmacao=1"
        >Não recebeu o e-mail de confirmação?</RouterLink
      >
    </div>
    <template #footer>
      <p>
        Ainda não tem uma conta?
        <RouterLink class="auth-link" to="/cadastro">Criar conta</RouterLink>
      </p>
    </template>
  </AuthLayout>
</template>
