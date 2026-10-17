<script setup lang="ts">
withDefaults(defineProps<{ name?: string }>(), { name: 'entrada' })
const paths: Record<string, string> = {
  entrada: 'M17 7 7 17M7 7v10h10',
  saida: 'M7 17 17 7M7 7h10v10',
  mais: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  banco: 'm3 9 9-6 9 6H3Zm2 2v8m5-8v8m4-8v8m5-8v8M3 21h18',
  documento: 'M14 3H5v18h14V8l-5-5Zm0 0v6h5M8 13h8M8 17h6',
  alerta: 'M12 8v5m0 3v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  cartao: 'M3 5h18v14H3V5Zm0 5h18M6 15h4',
  sol: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
  config:
    'm9 3-1 3-3 1-2 4 2 3v3l4 2 3-1 3 1 4-2v-3l2-3-2-4-3-1-1-3H9Zm7 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  perfil: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2H4Z',
  fechar: 'm6 6 12 12M6 18 18 6',
}
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.entrada" />
  </svg>
</template>
