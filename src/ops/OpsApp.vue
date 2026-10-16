<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  fetchOpsFeedbacks,
  formatTime,
  problemTypeLabel,
  type OpsFeedbackItem,
} from './api'

const list = ref<OpsFeedbackItem[]>([])
const loading = ref(false)
const error = ref('')
const previewUrl = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    list.value = await fetchOpsFeedbacks()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="ops">
    <header class="ops-header">
      <div>
        <h1>运营后台 · 问题反馈</h1>
        <p class="sub">查看客户端提交的全部反馈，与 App 内用户历史入口无关</p>
      </div>
      <button type="button" class="refresh" :disabled="loading" @click="load">
        {{ loading ? '刷新中...' : '刷新' }}
      </button>
    </header>

    <main class="ops-main">
      <p v-if="error" class="banner error">{{ error }}</p>
      <p v-else-if="loading && !list.length" class="banner">加载中...</p>
      <p v-else-if="!list.length" class="banner">暂无提交记录。请在客户端 `#/feedback` 提交后再刷新。</p>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 160px">提交时间</th>
              <th style="width: 110px">问题类型</th>
              <th>问题描述</th>
              <th style="width: 160px">联系方式</th>
              <th style="width: 180px">截图</th>
              <th style="width: 180px">ID</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in list" :key="item.id">
              <td>{{ formatTime(item.createdAt) }}</td>
              <td>
                <span class="tag">{{ problemTypeLabel(item.problemType) }}</span>
              </td>
              <td class="content">{{ item.content }}</td>
              <td>{{ item.contact || '—' }}</td>
              <td>
                <div v-if="item.images.length" class="thumbs">
                  <button
                    v-for="(src, idx) in item.images"
                    :key="src"
                    type="button"
                    class="thumb"
                    @click="previewUrl = src"
                  >
                    <img :src="src" :alt="`截图 ${idx + 1}`" />
                  </button>
                </div>
                <span v-else>—</span>
              </td>
              <td class="mono">{{ item.id }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <div v-if="previewUrl" class="lightbox" @click="previewUrl = ''">
      <img :src="previewUrl" alt="截图预览" @click.stop />
    </div>
  </div>
</template>

<style scoped>
.ops {
  min-height: 100vh;
}

.ops-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 28px;
  background: #fff;
  border-bottom: 1px solid #e5e6eb;
}

.ops-header h1 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 650;
}

.sub {
  margin: 0;
  color: #86909c;
  font-size: 13px;
}

.refresh {
  height: 36px;
  padding: 0 16px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #1f2329;
}

.refresh:hover:not(:disabled) {
  border-color: #c9cdd4;
}

.refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ops-main {
  padding: 20px 28px 40px;
}

.banner {
  margin: 0;
  padding: 16px 18px;
  border-radius: 10px;
  background: #fff;
  color: #4e5969;
  border: 1px solid #e5e6eb;
}

.banner.error {
  color: #cb2634;
  background: #ffece8;
  border-color: #f8c9c6;
}

.table-wrap {
  overflow: auto;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 960px;
}

th,
td {
  padding: 12px 14px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid #f0f1f3;
}

th {
  font-size: 12px;
  font-weight: 600;
  color: #86909c;
  background: #fafbfc;
  position: sticky;
  top: 0;
}

tbody tr:last-child td {
  border-bottom: none;
}

.content {
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 420px;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fff1ea;
  color: #d4896a;
  font-size: 12px;
}

.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.thumb {
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  overflow: hidden;
  background: #f7f8fa;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #86909c;
  word-break: break-all;
}

.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.lightbox img {
  max-width: min(920px, 100%);
  max-height: 90vh;
  border-radius: 8px;
  background: #fff;
}
</style>
