<script setup lang="ts">
import { ref } from 'vue'
import logo from '../../midia/logo-krab-png.png'
import '../assets/dashboard.css'
import '../assets/forms.css'
import { useRouter } from 'vue-router'
import { fazerLogin } from '../services/auth'
import { useAuthStore } from '../stores/auth'

// Os campos pertencem somente à tela. A senha nunca entra na store.
const email = ref('')
const senha = ref('')
const mostrarSenha = ref(false)
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
        ? 'Não foi possível conectar ao sistema. Tente novamente em instantes.'
        : erro instanceof Error
          ? erro.message
          : 'Não foi possível realizar o login.'
  } finally {
    entrando.value = false
  }
}
</script>

<template>
  <main class="dashboard-shell login-page">
    <section class="panel login-panel" aria-labelledby="login-title">
      <img class="login-logo" :src="logo" alt="KRAB — Keep Resources Always Balanced" />
      <h1 id="login-title">Bem-vindo de volta</h1>
      <p class="form-hint">Acesse sua conta para continuar.</p>
      <form class="cadastro-form" @submit.prevent="entrar">
        <fieldset :disabled="entrando">
          <label for="email"
            >E-mail<input
              id="email"
              v-model="email"
              type="email"
              autocomplete="username"
              placeholder="voce@exemplo.com"
              required
          /></label>
          <label for="senha">Senha</label>
          <div class="password-field">
            <input
              id="senha"
              v-model="senha"
              :type="mostrarSenha ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="Digite sua senha"
              required
            />
            <button
              type="button"
              :aria-pressed="mostrarSenha"
              aria-controls="senha"
              @click="mostrarSenha = !mostrarSenha"
            >
              {{ mostrarSenha ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
          <button class="submit-button" type="submit" :disabled="entrando">
            {{ entrando ? 'Entrando…' : 'Entrar' }}
          </button>
        </fieldset>
        <p v-if="mensagem" class="form-error" role="alert">{{ mensagem }}</p>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  place-items: center;
  padding: 24px;
}
.login-panel {
  width: min(100%, 440px);
  padding: clamp(24px, 6vw, 40px);
}
.login-logo {
  display: block;
  width: 190px;
  max-width: 100%;
  margin: 0 auto 30px;
}
h1 {
  font-size: 28px;
  margin: 0 0 10px;
}
.password-field {
  display: flex;
  gap: 8px;
  margin-top: -14px;
}
.password-field button {
  border: 1px solid #28433e;
  border-radius: 10px;
  background: #0a211d;
  color: #b5f5dd;
  cursor: pointer;
}
input:user-invalid {
  border-color: #ff7f87;
}
.submit-button {
  color: #001813;
}
</style>
