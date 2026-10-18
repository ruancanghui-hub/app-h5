<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

interface ClientRow {
  clientId: string
  name: string
  bundleIds: string[]
  redirectUris: string[]
  appleAudiences: string[]
  googleAudiences: string[]
}

const list = ref<ClientRow[]>([])
const loading = ref(false)
const error = ref('')
const message = ref('')
const form = reactive({
  clientId: '',
  name: '',
  bundleIds: '',
  redirectUris: '',
  appleAudiences: '',
  googleAudiences: '',
})

function lines(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/identity/ops/clients')
    if (!res.ok) throw new Error(`加载失败(${res.status})`)
    const data = (await res.json()) as { list: ClientRow[] }
    list.value = data.list ?? []
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function edit(row: ClientRow) {
  form.clientId = row.clientId
  form.name = row.name
  form.bundleIds = row.bundleIds.join('\n')
  form.redirectUris = row.redirectUris.join('\n')
  form.appleAudiences = row.appleAudiences.join('\n')
  form.googleAudiences = row.googleAudiences.join('\n')
  message.value = ''
}

async function save() {
  error.value = ''
  message.value = ''
  const res = await fetch('/api/identity/ops/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: form.clientId.trim(),
      name: form.name.trim(),
      bundleIds: lines(form.bundleIds),
      redirectUris: lines(form.redirectUris),
      appleAudiences: lines(form.appleAudiences),
      googleAudiences: lines(form.googleAudiences),
    }),
  })
  const data = (await res.json()) as { message?: string }
  if (!res.ok) {
    error.value = data.message || '保存失败'
    return
  }
  message.value = '已保存'
  await load()
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="ops">
    <header class="ops-header">
      <div>
        <h1>运营后台 · 接入应用</h1>
        <p class="sub">内部登记公钥客户端。不对外开放自助入驻。</p>
      </div>
      <a class="refresh" href="/admin.html">问题反馈</a>
    </header>
    <main class="ops-main">
      <p v-if="error" class="banner error">{{ error }}</p>
      <p v-if="message" class="banner">{{ message }}</p>
      <form class="form" @submit.prevent="save">
        <label>client_id<input v-model="form.clientId" required placeholder="my-app" /></label>
        <label>名称<input v-model="form.name" required /></label>
        <label>包名 / Bundle ID（每行一个）<textarea v-model="form.bundleIds" rows="3" /></label>
        <label>回跳地址（每行一个）<textarea v-model="form.redirectUris" rows="3" /></label>
        <label>Apple 受众（Services ID / Bundle ID）<textarea v-model="form.appleAudiences" rows="2" /></label>
        <label>Google 受众（OAuth Client ID）<textarea v-model="form.googleAudiences" rows="2" /></label>
        <button class="refresh" type="submit">保存</button>
      </form>
      <p v-if="loading" class="banner">加载中...</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>client_id</th>
              <th>名称</th>
              <th>包名</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in list" :key="row.clientId">
              <td>{{ row.clientId }}</td>
              <td>{{ row.name }}</td>
              <td>{{ row.bundleIds.join(', ') }}</td>
              <td><button type="button" class="refresh" @click="edit(row)">编辑</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<style scoped>
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
.ops-main {
  padding: 20px 28px 40px;
}
.banner {
  margin: 0 0 12px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e5e6eb;
}
.banner.error {
  color: #cb2634;
  background: #ffece8;
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
}
th,
td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid #f0f1f3;
}
.form {
  display: grid;
  gap: 12px;
  max-width: 640px;
  margin-bottom: 24px;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
}
label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: #5c6370;
}
input,
textarea {
  width: 100%;
  border: 1px solid #e6e8ee;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  color: #1f2329;
}
.ops-header a.refresh {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}
</style>
