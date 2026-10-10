<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main>
    <h1>KRAB</h1>
    <p>Keep Resources Always Balanced</p>

    <RouterLink to="/despesas">
      <button type="button">Cadastrar despesa</button>
    </RouterLink>
  </main>
</template>

<style scoped></style>
