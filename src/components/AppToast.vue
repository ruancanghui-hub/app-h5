<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { state } = useToast()
</script>

<template>
  <Teleport to="body">
    <Transition name="toast-fade">
      <div v-if="state.visible" class="toast" role="status">{{ state.message }}</div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  top: 45%;
  transform: translate(-50%, -50%);
  z-index: 10000;
  max-width: 70%;
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
  pointer-events: none;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}
</style>
