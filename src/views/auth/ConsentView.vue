<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppNavBar from '@/components/AppNavBar.vue'
import { bridge } from '@/bridge'
import {
  consentAuthorize,
  exchangeAuthCode,
  fetchClient,
  type ClientPublic,
} from '@/api/identity'
import { useAuthFlow } from '@/composables/useAuthFlow'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const { show } = useToast()
const {
  clientId,
  redirectUri,
  state,
  ensurePkce,
  loadLoginTicket,
  finishPkce,
  loadVerifier,
} = useAuthFlow()

const client = ref<ClientPublic | null>(null)
const submitting = ref(false)
const loading = ref(true)

function scopeLabel(scope: string): string {
  const map: Record<string, string> = {
    identity_id: '身份标识',
    email: '邮箱',
    display_name: '显示名',
    avatar: '头像',
  }
  return map[scope] || scope
}

onMounted(async () => {
  try {
    client.value = await fetchClient(clientId.value)
  } catch (err) {
    show(err instanceof Error ? err.message : '无法加载接入应用')
  } finally {
    loading.value = false
  }
})

async function onBack() {
  await router.push({
    name: 'auth-login',
    query: {
      client_id: clientId.value,
      ...(redirectUri.value ? { redirect_uri: redirectUri.value } : {}),
      ...(state.value ? { state: state.value } : {}),
    },
  })
}

async function onAgree() {
  if (submitting.value) return
  const ticket = loadLoginTicket()
  if (!ticket) {
    show('请先登录')
    await onBack()
    return
  }
  submitting.value = true
  try {
    const { challenge } = await ensurePkce()
    const { code } = await consentAuthorize({
      loginTicket: ticket,
      clientId: clientId.value,
      codeChallenge: challenge,
      redirectUri: redirectUri.value,
    })
    const verifier = loadVerifier()
    if (!verifier) throw new Error('缺少 PKCE verifier')

    const tokens = await exchangeAuthCode({
      grantType: 'authorization_code',
      clientId: clientId.value,
      code,
      codeVerifier: verifier,
    })

    await bridge.setAuth({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      identityId: tokens.identityId,
      expiresAt: tokens.expiresAt,
    })
    finishPkce()

    await router.replace({
      name: 'auth-done',
      query: {
        client_id: clientId.value,
        ...(state.value ? { state: state.value } : {}),
      },
    })
  } catch (err) {
    show(err instanceof Error ? err.message : '授权失败')
  } finally {
    submitting.value = false
  }
}

async function onDeny() {
  finishPkce()
  await bridge.closePage()
}
</script>

<template>
  <div class="page auth-page">
    <AppNavBar title="授权确认" @back="onBack" />
    <div class="page-body">
      <p v-if="loading" class="lead">加载中…</p>
      <template v-else-if="client">
        <h2 class="app-name">{{ client.name }}</h2>
        <p class="lead">将获得以下基础资料，用于为你提供服务：</p>
        <ul class="scopes">
          <li v-for="s in client.scopes" :key="s">{{ scopeLabel(s) }}</li>
        </ul>
        <button class="primary-btn" type="button" :disabled="submitting" @click="onAgree">
          {{ submitting ? '授权中…' : '同意并继续' }}
        </button>
        <button class="ghost-btn" type="button" :disabled="submitting" @click="onDeny">拒绝</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.app-name {
  margin: 8px 0 4px;
  font-size: 22px;
  font-weight: 700;
}
.lead {
  margin: 8px 0 16px;
  color: var(--color-text-secondary);
  font-size: 14px;
}
.scopes {
  margin: 0 0 24px;
  padding: 12px 16px;
  list-style: none;
  background: var(--color-surface);
  border-radius: var(--radius-md);
}
.scopes li {
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 15px;
}
.scopes li:last-child {
  border-bottom: none;
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
.primary-btn:disabled {
  opacity: 0.6;
}
.ghost-btn {
  width: 100%;
  height: 48px;
  margin-top: 12px;
  border-radius: var(--radius-pill);
  color: var(--color-text-secondary);
  font-size: 15px;
}
</style>
