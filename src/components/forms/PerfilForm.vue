<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { obterPerfil, salvarPerfil, type Perfil } from '../../services/perfil'
import { useAuthStore } from '../../stores/auth'

import Icon from '../dashboard/DashboardIcon.vue'
import { useNotificacoesStore } from '../../stores/notificacoes'
const notificacoes = useNotificacoesStore()
const privacidade = ref(false)
const botaoEditar = ref<HTMLButtonElement>()
const campoNome = ref<HTMLInputElement>()
const botaoPrivacidade = ref<HTMLButtonElement>()
const tituloPrivacidade = ref<HTMLElement>()
function abrirPrivacidade() {
  privacidade.value = true
  void nextTick(() => tituloPrivacidade.value?.focus())
}
function voltarPerfil() {
  privacidade.value = false
  void nextTick(() => botaoPrivacidade.value?.focus())
}
const emit = defineEmits<{ ocupado: [valor: boolean]; salvo: []; sair: [] }>()
const auth = useAuthStore()
const perfil = ref<Perfil | null>(null)
const nome = ref('')
const carregando = ref(true)
const salvando = ref(false)
const editando = ref(false)
const erroLeitura = ref('')
const erroEdicao = ref('')
const sucesso = ref('')
const alterado = computed(() => editando.value && nome.value !== (perfil.value?.nome ?? ''))
defineExpose({ alterado })

function mensagemSessaoOu(padrao: string): string {
  return auth.accessToken ? padrao : 'Sua sessão expirou. Entre novamente para continuar.'
}
async function carregar() {
  carregando.value = true
  erroLeitura.value = ''
  try {
    perfil.value = await obterPerfil(auth.obterToken())
  } catch {
    erroLeitura.value = mensagemSessaoOu('Não foi possível carregar seu perfil. Tente novamente.')
  } finally {
    carregando.value = false
  }
}
function editar() {
  nome.value = perfil.value?.nome ?? ''
  erroEdicao.value = sucesso.value = ''
  editando.value = true
  void nextTick(() => campoNome.value?.focus())
}
function cancelar() {
  if (salvando.value) return
  nome.value = perfil.value?.nome ?? ''
  erroEdicao.value = ''
  editando.value = false
  void nextTick(() => botaoEditar.value?.focus())
}
async function salvar() {
  if (salvando.value) return
  erroEdicao.value = sucesso.value = ''
  const valor = nome.value.trim()
  if (!valor || valor.length > 80) {
    erroEdicao.value = 'Informe seu nome com 1 a 80 caracteres.'
    return
  }
  salvando.value = true
  emit('ocupado', true)
  try {
    perfil.value = await salvarPerfil(valor, auth.obterToken())
    nome.value = perfil.value.nome ?? ''
    editando.value = false
    sucesso.value = 'Perfil atualizado com sucesso.'
    notificacoes.adicionar({
      tipo: 'sucesso',
      titulo: 'Perfil atualizado',
      mensagem: 'Seu nome foi salvo.',
      grupo: 'perfil',
    })
    emit('salvo')
    void nextTick(() => botaoEditar.value?.focus())
  } catch {
    erroEdicao.value = mensagemSessaoOu('Não foi possível atualizar seu perfil. Tente novamente.')
    notificacoes.adicionar({
      tipo: 'erro',
      titulo: 'Não foi possível salvar',
      mensagem: erroEdicao.value,
      grupo: 'perfil',
    })
  } finally {
    salvando.value = false
    emit('ocupado', false)
  }
}
onMounted(carregar)
</script>

<template>
  <div class="cadastro-form" :aria-busy="carregando || salvando">
    <div v-show="!privacidade">
      <p v-if="carregando" role="status">Carregando seu perfil…</p>
      <div v-else-if="erroLeitura" class="form-error" role="alert">
        <p>{{ erroLeitura }}</p>
        <button v-if="auth.accessToken" class="retry" @click="carregar">Tentar novamente</button>
      </div>
      <template v-else-if="perfil">
        <div class="profile-avatar"><Icon name="perfil" /></div>
        <form v-if="editando" @submit.prevent="salvar">
          <fieldset :disabled="salvando">
            <label for="perfil-nome"
              >Nome<input
                id="perfil-nome"
                ref="campoNome"
                v-model="nome"
                autocomplete="name"
                required
                maxlength="80"
                placeholder="Digite seu nome"
                :aria-invalid="Boolean(erroEdicao)"
                :aria-describedby="erroEdicao ? 'perfil-erro' : undefined"
            /></label>
            <button class="submit-button" :disabled="salvando || !auth.accessToken">
              {{ salvando ? 'Salvando…' : 'Salvar alterações' }}
            </button>
            <button type="button" class="retry" :disabled="salvando" @click="cancelar">
              Cancelar
            </button>
          </fieldset>
        </form>
        <template v-else>
          <dl>
            <dt>Nome</dt>
            <dd class="profile-name">{{ perfil.nome ?? 'Nome ainda não informado.' }}</dd>
          </dl>
          <button
            ref="botaoEditar"
            class="submit-button"
            :disabled="!auth.accessToken"
            @click="editar"
          >
            Editar perfil
          </button>
        </template>
        <p v-if="erroEdicao" id="perfil-erro" class="form-error" role="alert">{{ erroEdicao }}</p>
        <p v-if="sucesso" class="form-success" role="status">{{ sucesso }}</p>
      </template>
      <section class="profile-privacy">
        <h3>Privacidade</h3>
        <button
          type="button"
          class="panel-secondary"
          ref="botaoPrivacidade"
          aria-controls="perfil-privacidade"
          @click="abrirPrivacidade"
        >
          Política de privacidade
        </button>
      </section>
      <div class="profile-session">
        <button
          type="button"
          class="panel-secondary session-exit"
          :disabled="salvando"
          @click="emit('sair')"
        >
          Sair da conta
        </button>
      </div>
      <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
    </div>
    <section v-if="privacidade" id="perfil-privacidade" class="privacy-copy">
      <div class="privacy-heading">
        <div class="header-control">
          <button
            type="button"
            class="panel-secondary privacy-back"
            aria-label="Voltar ao perfil"
            aria-describedby="tooltip-voltar"
            @click="voltarPerfil"
          >
            <Icon name="voltar" />
          </button>
          <span id="tooltip-voltar" class="header-tooltip" role="tooltip">Voltar ao perfil</span>
        </div>
        <h3 ref="tituloPrivacidade" tabindex="-1">Política de privacidade</h3>
      </div>
      <section>
        <h4>Sua privacidade</h4>
        <p><strong>Sua privacidade é importante para nós.</strong></p>
        <p>
          O KRAB utiliza dados pessoais e financeiros exclusivamente para permitir o funcionamento
          das ferramentas de gestão oferecidas pelo sistema, como cadastro de contas, receitas,
          despesas, saldos e relatórios.
        </p>
      </section>
      <section>
        <h4>Quais informações utilizamos</h4>
        <p>
          Podemos tratar informações relacionadas à sua conta e aos registros financeiros inseridos
          por você no sistema, de acordo com as funcionalidades utilizadas.
        </p>
      </section>
      <section>
        <h4>Como utilizamos</h4>
        <p>Seus dados são utilizados para:</p>
        <ul>
          <li>Autenticar seu acesso ao KRAB;</li>
          <li>Armazenar e apresentar seus registros financeiros;</li>
          <li>Calcular e disponibilizar informações de gestão;</li>
          <li>Permitir consultas, relatórios e demais funcionalidades do sistema;</li>
          <li>Manter a segurança e a integridade da aplicação.</li>
        </ul>
      </section>
      <section>
        <h4>Segurança</h4>
        <p>
          O KRAB adota mecanismos de autenticação, controle de acesso e outras medidas técnicas e
          administrativas destinadas a reduzir riscos de acesso não autorizado, alteração, perda ou
          uso indevido das informações.
        </p>
        <p>
          Os dados financeiros de uma conta devem ser acessíveis somente pelo usuário autorizado
          correspondente.
        </p>
      </section>
      <section>
        <h4>Compartilhamento</h4>
        <p>
          O KRAB não utiliza suas informações financeiras para fins publicitários nem vende seus
          dados pessoais.
        </p>
        <p>
          Qualquer processamento técnico necessário ao funcionamento da aplicação deve respeitar as
          finalidades do sistema e as regras aplicáveis de proteção de dados.
        </p>
      </section>
      <section>
        <h4>Seus direitos</h4>
        <p>
          Nos termos da Lei Geral de Proteção de Dados Pessoais (LGPD), o titular pode possuir
          direitos relacionados aos seus dados, incluindo acesso, correção, confirmação da
          existência de tratamento e, quando aplicável, solicitação de eliminação, bloqueio ou
          outras medidas previstas em lei.
        </p>
      </section>
      <section>
        <h4>Transparência</h4>
        <p>
          Caso a forma de tratamento dos dados seja alterada futuramente, esta Política de
          Privacidade deverá ser atualizada para refletir o funcionamento real do KRAB.
        </p>
      </section>
    </section>
  </div>
</template>

<style scoped>
@import '../../assets/forms.css';
.profile-name {
  margin: 8px 0 24px;
  font-size: 20px;
  overflow-wrap: anywhere;
}
dt {
  color: var(--muted-9faeac);
}
</style>
