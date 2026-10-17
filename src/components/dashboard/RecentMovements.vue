<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { dataFinanceira, moeda, type Movimento } from '../../services/dashboard'
import Icon from './DashboardIcon.vue'
defineProps<{ itens: Movimento[]; carregando: boolean; erro: string; autenticado: boolean }>()
defineEmits<{ tentar: [] }>()
</script>

<template>
  <section class="panel movements" :aria-busy="carregando">
    <div class="section-heading">
      <div>
        <h2>Movimentações recentes</h2>
        <p>Últimos lançamentos registrados</p>
      </div>
      <span v-if="!carregando && !erro" class="badge">{{ itens.length }} movimentações</span>
    </div>
    <p v-if="carregando" role="status" class="state-message">Carregando movimentações…</p>
    <div v-else-if="erro" role="alert" class="state-message">
      <p>{{ erro }}</p>
      <button v-if="autenticado" class="retry" @click="$emit('tentar')">Tentar novamente</button
      ><RouterLink v-else to="/login">Entrar novamente</RouterLink>
    </div>
    <p v-else-if="!itens.length" class="state-message">Nenhuma movimentação registrada ainda.</p>
    <ul v-else class="movement-list">
      <li v-for="item in itens" :key="`${item.tipo}-${item.id}`" :class="item.tipo">
        <span class="icon-box"><Icon :name="item.tipo === 'receita' ? 'entrada' : 'saida'" /></span>
        <div class="movement-description">
          <strong>{{ item.descricao }}</strong>
          <p>
            {{ item.tipo === 'receita' ? 'Receita' : 'Despesa' }} • {{ dataFinanceira(item.data) }}
          </p>
        </div>
        <strong class="movement-value"
          >{{ item.tipo === 'receita' ? '+' : '-' }} {{ moeda(Math.abs(item.valor)) }}</strong
        >
      </li>
    </ul>
  </section>
</template>
