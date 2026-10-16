<script setup lang="ts">
defineProps<{
  title: string
}>()

const emit = defineEmits<{
  back: []
  action: []
}>()
</script>

<template>
  <header class="nav">
    <div class="nav-inner">
      <button class="nav-btn" type="button" aria-label="返回" @click="emit('back')">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M15.5 4.5L8 12l7.5 7.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <h1 class="nav-title">{{ title }}</h1>
      <button
        v-if="$slots.action"
        class="nav-btn"
        type="button"
        aria-label="更多"
        @click="emit('action')"
      >
        <slot name="action" />
      </button>
      <div v-else class="nav-btn placeholder" />
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding-top: var(--safe-top);
  background: #fff;
}

.nav-inner {
  height: var(--nav-height);
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  padding: 0 12px;
}

.nav-title {
  margin: 0;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
}

.nav-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-surface);
  color: #333;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.nav-btn.placeholder {
  visibility: hidden;
  pointer-events: none;
}

.nav-btn:active {
  opacity: 0.75;
}
</style>
