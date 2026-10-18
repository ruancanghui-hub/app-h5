<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppNavBar from '@/components/AppNavBar.vue'
import { bridge } from '@/bridge'

const identityId = ref('')

onMounted(async () => {
  const auth = await bridge.getAuth()
  identityId.value = auth?.identityId || auth?.userId || ''
})

async function onClose() {
  await bridge.closePage()
}
</script>

<template>
  <div class="page auth-page">
    <AppNavBar title="登录成功" @back="onClose" />
    <div class="page-body">
      <p class="ok">会话已回写宿主（Bridge setAuth）。</p>
      <p v-if="identityId" class="meta">Identity：{{ identityId }}</p>
      <button class="primary-btn" type="button" @click="onClose">完成</button>
    </div>
  </div>
</template>

<style scoped>
.ok {
  margin: 24px 0 8px;
  font-size: 16px;
  font-weight: 600;
}
.meta {
  margin: 0 0 24px;
  font-size: 13px;
  color: var(--color-text-secondary);
  word-break: break-all;
}
.primary-btn {
  width: 100%;
  height: 48px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
</style>
