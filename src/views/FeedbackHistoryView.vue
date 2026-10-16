<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppNavBar from '@/components/AppNavBar.vue'

const router = useRouter()

function onBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.replace({ name: 'feedback' })
}
</script>

<template>
  <div class="page">
    <AppNavBar title="历史反馈" @back="onBack" />
    <div class="page-body empty">
      <p class="title">暂无历史记录</p>
      <p class="desc">此处为用户自己的历史占位，运营查看请使用独立运营后台</p>
    </div>
  </div>
</template>

<style scoped>
.empty {
  padding-top: 80px;
  text-align: center;
}

.title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.desc {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>
