<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AuthLayout from '../components/auth/AuthLayout.vue'
import CampoSenha from '../components/auth/CampoSenha.vue'
import { cadastrarUsuario, reenviarConfirmacao } from '../services/cadastro'
import { useNotificacoesStore } from '../stores/notificacoes'

const route = useRoute()
const notificacoes = useNotificacoesStore()
const nome = ref('')
const email = ref('')
const password = ref('')
const confirmar = ref('')
const emailConfirmacao = ref('')
const emailCadastrado = ref('')
const enviando = ref(false)
const reenviando = ref(false)
const finalizado = ref(false)
const confirmacaoPendente = ref(false)
const reenvioConcluido = ref(false)
const erros = reactive({ nome: '', email: '', password: '', confirmar: '', emailConfirmacao: '' })
const formulario = ref<HTMLFormElement>()
const formularioReenvio = ref<HTMLFormElement>()
const somenteConfirmacao = computed(() => route.query.confirmacao === '1')
const ocupado = computed(() => enviando.value || reenviando.value)
const titulo = computed(() =>
  somenteConfirmacao.value
    ? 'Confirme seu e-mail'
    : finalizado.value
      ? confirmacaoPendente.value
        ? 'Falta só confirmar'
        : 'Sua conta está pronta'
      : 'Seja bem-vindo ao KRAB',
)
const descricao = computed(() =>
  somenteConfirmacao.value
    ? 'Solicite um novo link para concluir a confirmação do seu cadastro.'
    : finalizado.value
      ? confirmacaoPendente.value
        ? 'Confirme seu e-mail antes de acessar o KRAB.'
        : 'Agora é só entrar e começar a organizar suas finanças.'
      : 'Dê o primeiro passo para organizar suas finanças com mais clareza.',
)
let erroId: number | undefined
let controlador: AbortController | undefined
let controladorReenvio: AbortController | undefined
let ativo = true
let versao = 0
function limparFeedback() {
  if (erroId !== undefined) notificacoes.remover(erroId)
  erroId = undefined
}
function validar(campo: keyof typeof erros) {
  if (campo === 'nome')
    erros.nome =
      nome.value.trim().length >= 1 && nome.value.trim().length <= 80
        ? ''
        : 'Informe seu nome com até 80 caracteres.'
  else if (campo === 'email' || campo === 'emailConfirmacao')
    erros[campo] =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        (campo === 'email' ? email.value : emailConfirmacao.value).trim(),
      ) && (campo === 'email' ? email.value : emailConfirmacao.value).trim().length <= 254
        ? ''
        : 'Informe um e-mail válido.'
  else if (campo === 'password')
    erros.password =
      password.value.length < 8
        ? 'Use pelo menos 8 caracteres.'
        : new TextEncoder().encode(password.value).length > 72
          ? 'Esta senha ficou longa demais. Use uma combinação mais curta.'
          : ''
  else
    erros.confirmar = !confirmar.value
      ? 'Digite sua senha novamente.'
      : confirmar.value !== password.value
        ? 'As senhas precisam ser iguais.'
        : ''
}
function editar(campo: keyof typeof erros) {
  limparFeedback()
  if (erros[campo]) validar(campo)
  if (campo === 'password' && confirmar.value) validar('confirmar')
  if (campo === 'emailConfirmacao') reenvioConcluido.value = false
}
async function destacarErros(form: HTMLFormElement | undefined) {
  erroId = notificacoes.adicionar({
    grupo: 'autenticacao',
    tipo: 'aviso',
    titulo: 'Revise os campos destacados',
    mensagem: 'Faltam alguns ajustes para continuar.',
  })
  await nextTick()
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
function erroDaAcao(falha: unknown, tituloErro: string) {
  erroId = notificacoes.adicionar({
    grupo: 'autenticacao',
    tipo: 'erro',
    titulo: tituloErro,
    mensagem:
      falha instanceof TypeError
        ? 'Não foi possível conectar ao sistema. Confira sua conexão e tente novamente.'
        : falha instanceof Error
          ? falha.message
          : 'Tente novamente em instantes.',
  })
}
async function cadastrar() {
  if (ocupado.value) return
  limparFeedback()
  for (const campo of ['nome', 'email', 'password', 'confirmar'] as const) validar(campo)
  if (erros.nome || erros.email || erros.password || erros.confirmar) {
    await destacarErros(formulario.value)
    return
  }
  const atual = versao
  enviando.value = true
  controlador = new AbortController()
  const dados = {
    nome: nome.value.trim(),
    email: email.value.trim().toLowerCase(),
    password: password.value,
    confirmar_senha: confirmar.value,
  }
  try {
    const resposta = await cadastrarUsuario(dados, controlador.signal)
    if (!ativo || atual !== versao) return
    confirmacaoPendente.value = resposta.confirmacao_pendente
    emailCadastrado.value = emailConfirmacao.value = dados.email
    password.value = confirmar.value = ''
    finalizado.value = true
    notificacoes.adicionar({
      grupo: 'autenticacao',
      tipo: resposta.confirmacao_pendente ? 'informacao' : 'sucesso',
      titulo: resposta.confirmacao_pendente ? 'Cadastro recebido' : 'Conta criada com sucesso',
      mensagem: resposta.confirmacao_pendente
        ? 'Confira seu e-mail e siga o link de confirmação antes de entrar.'
        : 'Você já pode entrar no KRAB com seu e-mail e sua senha.',
    })
  } catch (falha) {
    if (ativo && atual === versao && !(falha instanceof Error && falha.name === 'AbortError'))
      erroDaAcao(falha, 'Não foi possível criar a conta')
  } finally {
    if (ativo && atual === versao) enviando.value = false
  }
}
async function reenviar() {
  if (ocupado.value) return
  limparFeedback()
  validar('emailConfirmacao')
  if (erros.emailConfirmacao) {
    await destacarErros(formularioReenvio.value)
    return
  }
  const atual = versao
  reenviando.value = true
  reenvioConcluido.value = false
  controladorReenvio = new AbortController()
  try {
    const mensagem = await reenviarConfirmacao(
      emailConfirmacao.value.trim().toLowerCase(),
      controladorReenvio.signal,
    )
    if (!ativo || atual !== versao) return
    reenvioConcluido.value = true
    notificacoes.adicionar({
      grupo: 'autenticacao',
      tipo: 'sucesso',
      titulo: 'Solicitação de reenvio concluída',
      mensagem,
    })
  } catch (falha) {
    if (ativo && atual === versao && !(falha instanceof Error && falha.name === 'AbortError'))
      erroDaAcao(falha, 'Não foi possível reenviar o link')
  } finally {
    if (ativo && atual === versao) reenviando.value = false
  }
}
watch(somenteConfirmacao, () => {
  versao++
  controlador?.abort()
  controladorReenvio?.abort()
  limparFeedback()
  enviando.value = reenviando.value = false
  password.value = confirmar.value = ''
  if (!emailConfirmacao.value) emailConfirmacao.value = email.value.trim()
  Object.assign(erros, { nome: '', email: '', password: '', confirmar: '', emailConfirmacao: '' })
})
onBeforeUnmount(() => {
  ativo = false
  controlador?.abort()
  controladorReenvio?.abort()
  password.value = confirmar.value = ''
  limparFeedback()
})
</script>
<template>
  <AuthLayout
    :titulo="titulo"
    :descricao="descricao"
    :etapa="
      somenteConfirmacao || (finalizado && confirmacaoPendente)
        ? 'CONFIRMAÇÃO DE CADASTRO'
        : 'CRIE SUA CONTA'
    "
    :google="!somenteConfirmacao && !finalizado"
  >
    <form
      v-if="!finalizado && !somenteConfirmacao"
      ref="formulario"
      class="auth-form"
      novalidate
      :aria-busy="enviando"
      @submit.prevent="cadastrar"
    >
      <fieldset :disabled="ocupado">
        <div class="auth-field" :class="{ 'has-error': erros.nome }">
          <label for="cadastro-nome">Seu nome</label
          ><input
            id="cadastro-nome"
            v-model="nome"
            autocomplete="name"
            placeholder="Como podemos chamar você?"
            maxlength="80"
            required
            :aria-invalid="Boolean(erros.nome)"
            :aria-describedby="erros.nome ? 'cadastro-nome-erro' : undefined"
            @blur="validar('nome')"
            @input="editar('nome')"
          />
          <p v-if="erros.nome" id="cadastro-nome-erro" class="auth-field-error">{{ erros.nome }}</p>
        </div>
        <div class="auth-field" :class="{ 'has-error': erros.email }">
          <label for="cadastro-email">E-mail</label
          ><input
            id="cadastro-email"
            v-model="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            placeholder="voce@exemplo.com"
            maxlength="254"
            required
            :aria-invalid="Boolean(erros.email)"
            :aria-describedby="erros.email ? 'cadastro-email-erro' : undefined"
            @blur="validar('email')"
            @input="editar('email')"
          />
          <p v-if="erros.email" id="cadastro-email-erro" class="auth-field-error">
            {{ erros.email }}
          </p>
        </div>
        <div class="auth-password-pair">
          <CampoSenha
            id="cadastro-senha"
            v-model="password"
            label="Senha"
            autocomplete="new-password"
            :minlength="8"
            :erro="erros.password"
            ajuda="Pelo menos 8 caracteres."
            @blur="validar('password')"
            @editar="editar('password')"
          /><CampoSenha
            id="cadastro-confirmar"
            v-model="confirmar"
            label="Confirme a senha"
            autocomplete="new-password"
            :minlength="8"
            :erro="erros.confirmar"
            @blur="validar('confirmar')"
            @editar="editar('confirmar')"
          />
        </div>
        <button class="auth-primary" type="submit" :disabled="ocupado" :aria-busy="enviando">
          <span v-if="enviando" class="auth-spinner" aria-hidden="true"></span
          >{{ enviando ? 'Criando sua conta…' : 'Criar minha conta' }}
        </button>
      </fieldset>
    </form>
    <div v-if="finalizado && !somenteConfirmacao" class="auth-status-panel">
      <span class="auth-status-icon" aria-hidden="true"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <template v-if="confirmacaoPendente">
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="m3 7 9 6 9-6" />
          </template>
          <template v-else>
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12 3 3 5-6" />
          </template></svg
      ></span>
      <h2>
        {{ confirmacaoPendente ? 'Confira sua caixa de entrada' : 'Tudo pronto para começar' }}
      </h2>
      <p v-if="confirmacaoPendente">
        Procure a confirmação de cadastro em <strong>{{ emailCadastrado }}</strong
        >. Abra o link recebido para liberar seu acesso.
      </p>
      <p v-else>Seu cadastro foi concluído. Use seu e-mail e sua senha para entrar.</p>
    </div>
    <template v-if="somenteConfirmacao || (finalizado && confirmacaoPendente)">
      <h2 v-if="!somenteConfirmacao" class="auth-resend-heading">Não recebeu o link?</h2>
      <p class="auth-resend-note">
        Confira também o spam. Se precisar, solicite outro link abaixo. Este envio confirma seu
        cadastro; não altera sua senha.
      </p>
      <form
        ref="formularioReenvio"
        class="auth-form"
        novalidate
        :aria-busy="reenviando"
        @submit.prevent="reenviar"
      >
        <fieldset :disabled="ocupado">
          <div class="auth-field" :class="{ 'has-error': erros.emailConfirmacao }">
            <label for="confirmacao-email">E-mail do cadastro</label
            ><input
              id="confirmacao-email"
              v-model="emailConfirmacao"
              type="email"
              inputmode="email"
              autocomplete="email"
              autocapitalize="none"
              spellcheck="false"
              placeholder="voce@exemplo.com"
              maxlength="254"
              required
              :aria-invalid="Boolean(erros.emailConfirmacao)"
              :aria-describedby="erros.emailConfirmacao ? 'confirmacao-email-erro' : undefined"
              @blur="validar('emailConfirmacao')"
              @input="editar('emailConfirmacao')"
            />
            <p v-if="erros.emailConfirmacao" id="confirmacao-email-erro" class="auth-field-error">
              {{ erros.emailConfirmacao }}
            </p>
          </div>
          <button
            :class="somenteConfirmacao ? 'auth-primary' : 'auth-secondary'"
            type="submit"
            :disabled="ocupado"
          >
            <span v-if="reenviando" class="auth-spinner" aria-hidden="true"></span
            >{{ reenviando ? 'Solicitando novo link…' : 'Reenviar confirmação' }}
          </button>
        </fieldset>
      </form>
      <p v-if="reenvioConcluido" class="auth-resend-note">
        Solicitação concluída. Se houver um cadastro aguardando confirmação, você receberá um novo
        link.
      </p>
    </template>
    <RouterLink
      v-if="finalizado && !somenteConfirmacao"
      class="auth-primary"
      style="margin-top: 22px"
      to="/login"
      >{{ confirmacaoPendente ? 'Já confirmei meu e-mail. Entrar' : 'Ir para o login' }}</RouterLink
    >
    <template #footer
      ><p><RouterLink class="auth-link" to="/login">Voltar ao login</RouterLink></p>
      <p v-if="!somenteConfirmacao && !finalizado">
        <RouterLink class="auth-link" to="/cadastro?confirmacao=1"
          >Já se cadastrou e precisa de outro link?</RouterLink
        >
      </p>
      <p v-else-if="somenteConfirmacao">
        <RouterLink class="auth-link" to="/cadastro">Ainda não tenho cadastro</RouterLink>
      </p></template
    >
  </AuthLayout>
</template>
