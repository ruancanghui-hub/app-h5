<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppNavBar from '@/components/AppNavBar.vue'
import { bridge } from '@/bridge'
import { request } from '@/api/http'

const route = useRoute()
const message = ref('正在验证…')
const ok = ref(false)

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : ''
  if (!token) {
    message.value = '缺少验证凭证'
    return
  }
  try {
    await request('/identity/v1/email/verify', { method: 'POST', json: { token } })
    ok.value = true
    message.value = '邮箱已验证'
  } catch (err) {
    message.value = err instanceof Error ? err.message : '验证失败'
  }
})

async function onBack() {
  await bridge.closePage()
}
</script>

<template>
  <div class="page">
    <AppNavBar title="验证邮箱" @back="onBack" />
    <div class="page-body">
      <p class="lead" :class="{ ok }">{{ message }}</p>
    </div>
  </div>
</template>

<style scoped>
.lead {
  margin: 24px 0;
  font-size: 16px;
}
.ok {
  font-weight: 600;
}
</style>
