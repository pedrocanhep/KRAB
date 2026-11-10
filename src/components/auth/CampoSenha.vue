<script setup lang="ts">
import { ref } from 'vue'
withDefaults(
  defineProps<{
    id: string
    label: string
    autocomplete?: 'current-password' | 'new-password'
    erro?: string
    ajuda?: string
    minlength?: number
  }>(),
  { autocomplete: 'current-password' },
)
const modelo = defineModel<string>({ required: true })
defineEmits<{ blur: []; editar: [] }>()
const visivel = ref(false)
</script>
<template>
  <div class="auth-field" :class="{ 'has-error': erro }">
    <label :for="id">{{ label }}</label>
    <div class="auth-password">
      <input
        :id="id"
        v-model="modelo"
        :type="visivel ? 'text' : 'password'"
        :autocomplete="autocomplete"
        :minlength="minlength"
        :aria-invalid="Boolean(erro)"
        :aria-describedby="
          [erro ? `${id}-erro` : '', ajuda ? `${id}-ajuda` : ''].filter(Boolean).join(' ') ||
          undefined
        "
        required
        @blur="$emit('blur')"
        @input="$emit('editar')"
      />
      <button
        type="button"
        class="auth-eye"
        :aria-label="`${visivel ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`"
        :aria-pressed="visivel"
        :aria-controls="id"
        @mousedown.prevent
        @click="visivel = !visivel"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <template v-if="!visivel">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </template>
          <template v-else>
            <path
              d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3 3.8M6.1 6.1A22 22 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.7-1.5M10 10a3 3 0 0 0 4 4"
            />
          </template>
        </svg>
      </button>
    </div>
    <p v-if="erro" :id="`${id}-erro`" class="auth-field-error">{{ erro }}</p>
    <p v-if="ajuda" :id="`${id}-ajuda`" class="auth-field-help">{{ ajuda }}</p>
  </div>
</template>
