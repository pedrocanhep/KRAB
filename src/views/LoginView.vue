<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { fazerLogin } from '../services/auth'
import { useAuthStore } from '../stores/auth'

// Os campos pertencem somente à tela. A senha nunca entra na store.
const email = ref('')
const senha = ref('')
const mensagem = ref('')
const entrando = ref(false)
const auth = useAuthStore()
const router = useRouter()

async function entrar() {
  if (entrando.value) return
  entrando.value = true
  mensagem.value = ''
  try {
    const sessao = await fazerLogin(email.value, senha.value)
    auth.definirSessao(sessao.access_token, sessao.expires_at)
    // Só limpamos após sucesso; erros mantêm os campos para correção.
    senha.value = ''
    await router.push('/')
  } catch (erro) {
    mensagem.value =
      erro instanceof TypeError
        ? 'Não foi possível conectar à API. Verifique o backend e o CORS.'
        : erro instanceof Error
          ? erro.message
          : 'Não foi possível realizar o login.'
  } finally {
    entrando.value = false
  }
}
</script>

<template>
  <main>
    <h1>Entrar</h1>
    <form @submit.prevent="entrar">
      <div>
        <label for="email">E-mail</label>
        <input id="email" v-model="email" type="email" autocomplete="username" required />
      </div>
      <div>
        <label for="senha">Senha</label>
        <input id="senha" v-model="senha" type="password" autocomplete="off" required />
      </div>
      <button type="submit" :disabled="entrando">Entrar</button>
    </form>
    <p v-if="mensagem" role="status">{{ mensagem }}</p>
  </main>
</template>
