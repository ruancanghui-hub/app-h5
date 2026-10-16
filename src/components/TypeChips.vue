<script setup lang="ts">
import type { ProblemType } from '@/api/feedback'

defineProps<{
  modelValue: ProblemType
  options: { value: ProblemType; label: string }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ProblemType]
}>()
</script>

<template>
  <div class="chips" role="radiogroup" aria-label="问题类型">
    <button
      v-for="item in options"
      :key="item.value"
      type="button"
      role="radio"
      class="chip"
      :class="{ active: modelValue === item.value }"
      :aria-checked="modelValue === item.value"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chip {
  min-width: 88px;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: #333;
  font-size: 13px;
  border: 1px solid transparent;
}

.chip.active {
  background: var(--color-chip-active-bg);
  color: var(--color-chip-active-text);
  border-color: var(--color-chip-active-border);
  font-weight: 500;
}

.chip:active {
  opacity: 0.85;
}
</style>
