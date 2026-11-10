<script setup lang="ts">
import { usePreferenciasStore, type Preferencias } from '../../stores/preferencias'
import { useNotificacoesStore } from '../../stores/notificacoes'
import { useTemaStore } from '../../stores/tema'
const tema = useTemaStore()
const preferencias = usePreferenciasStore()
const notificacoes = useNotificacoesStore()
const opcoes: { chave: keyof Preferencias; texto: string }[] = [
  { chave: 'alertas', texto: 'Mostrar Alertas importantes' },
  { chave: 'resumo', texto: 'Mostrar Resumo rápido' },
  { chave: 'atividades', texto: 'Mostrar Atividades recentes' },
  { chave: 'atalhos', texto: 'Mostrar atalhos superiores' },
  { chave: 'menuFlutuante', texto: 'Mostrar menu flutuante de ações' },
]
function restaurar() {
  preferencias.restaurar()
  notificacoes.adicionar({
    tipo: 'sucesso',
    titulo: 'Visualização restaurada',
    mensagem: 'Todas as opções padrão estão ativas.',
    grupo: 'preferencias',
  })
}
</script>
<template>
  <div class="settings-content">
    <p class="drawer-note">As alterações aparecem imediatamente e ficam salvas neste navegador.</p>
    <section class="settings-appearance">
      <h3>Aparência</h3>
      <p class="drawer-note">
        {{ tema.atual === 'dark' ? 'Tema escuro' : 'Tema claro' }} · altere pelo botão no header.
      </p>
      <p v-if="tema.erroPersistencia" role="alert" class="drawer-note">
        {{ tema.erroPersistencia }}
      </p>
    </section>
    <fieldset class="settings-group">
      <legend>Home</legend>
      <label v-for="opcao in opcoes" :key="opcao.chave" class="settings-option">
        <span>{{ opcao.texto }}</span>
        <input v-model="preferencias.visualizacao[opcao.chave]" type="checkbox" role="switch" />
      </label>
    </fieldset>
    <fieldset class="settings-group">
      <legend>Interface</legend>
      <label class="settings-option"
        ><span>Mostrar notificações flutuantes</span
        ><input v-model="preferencias.visualizacao.notificacoes" type="checkbox" role="switch"
      /></label>
      <p class="drawer-note">Mensagens dentro dos formulários continuam disponíveis.</p>
    </fieldset>
    <button class="panel-secondary" type="button" @click="restaurar">
      Restaurar visualização padrão
    </button>
    <p v-if="preferencias.erroPersistencia" role="alert" class="drawer-note">
      {{ preferencias.erroPersistencia }}
    </p>
  </div>
</template>
