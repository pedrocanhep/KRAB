<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { obterPerfil, salvarPerfil, type Perfil } from '../../services/perfil'
import { useAuthStore } from '../../stores/auth'

const emit = defineEmits<{ ocupado: [valor: boolean] }>()
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
}
function cancelar() {
  if (salvando.value) return
  nome.value = perfil.value?.nome ?? ''
  erroEdicao.value = ''
  editando.value = false
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
  } catch {
    erroEdicao.value = mensagemSessaoOu('Não foi possível atualizar seu perfil. Tente novamente.')
  } finally {
    salvando.value = false
    emit('ocupado', false)
  }
}
onMounted(carregar)
</script>

<template>
  <div class="cadastro-form" :aria-busy="carregando || salvando">
    <p v-if="carregando" role="status">Carregando seu perfil…</p>
    <div v-else-if="erroLeitura" class="form-error" role="alert">
      <p>{{ erroLeitura }}</p>
      <button v-if="auth.accessToken" class="retry" @click="carregar">Tentar novamente</button>
    </div>
    <template v-else-if="perfil">
      <form v-if="editando" @submit.prevent="salvar">
        <fieldset :disabled="salvando">
          <label for="perfil-nome"
            >Nome<input
              id="perfil-nome"
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
        <button class="submit-button" :disabled="!auth.accessToken" @click="editar">
          Editar perfil
        </button>
      </template>
      <p v-if="erroEdicao" id="perfil-erro" class="form-error" role="alert">{{ erroEdicao }}</p>
      <p v-if="sucesso" class="form-success" role="status">{{ sucesso }}</p>
    </template>
    <RouterLink v-if="!auth.accessToken" to="/login">Entrar novamente</RouterLink>
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
  color: #9faeac;
}
</style>
