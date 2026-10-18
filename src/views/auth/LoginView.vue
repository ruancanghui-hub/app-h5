<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppNavBar from '@/components/AppNavBar.vue'
import { bridge } from '@/bridge'
import { loginAccount } from '@/api/identity'
import { useAuthFlow } from '@/composables/useAuthFlow'
import { useToast } from '@/composables/useToast'
import { isValidEmail } from '@/utils/validate'

const router = useRouter()
const { show } = useToast()
const { clientId, redirectUri, state, saveLoginTicket } = useAuthFlow()

const email = ref('')
const password = ref('')
const submitting = ref(false)

async function onBack() {
  await bridge.closePage()
}

function queryCarry() {
  return {
    client_id: clientId.value,
    ...(redirectUri.value ? { redirect_uri: redirectUri.value } : {}),
    ...(state.value ? { state: state.value } : {}),
  }
}

async function onSubmit() {
  if (submitting.value) return
  if (!isValidEmail(email.value.trim())) {
    show('请输入正确的邮箱')
    return
  }
  if (password.value.length < 8) {
    show('密码至少 8 位')
    return
  }
  submitting.value = true
  try {
    const result = await loginAccount({
      email: email.value.trim(),
      password: password.value,
    })
    saveLoginTicket(result.loginTicket)
    await router.push({ name: 'auth-consent', query: queryCarry() })
  } catch (err) {
    show(err instanceof Error ? err.message : '登录失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page auth-page">
    <AppNavBar title="登录" @back="onBack" />
    <div class="page-body">
      <p class="lead">使用邮箱凭证登录，授权后可接入当前 App。</p>
      <label class="field">
        <span class="label">邮箱</span>
        <input v-model="email" class="input" type="email" autocomplete="username" placeholder="name@example.com" />
      </label>
      <label class="field">
        <span class="label">密码</span>
        <input v-model="password" class="input" type="password" autocomplete="current-password" placeholder="至少 8 位" />
      </label>
      <button class="primary-btn" type="button" :disabled="submitting" @click="onSubmit">
        {{ submitting ? '登录中…' : '登录' }}
      </button>
      <div class="links">
        <RouterLink :to="{ name: 'auth-register', query: queryCarry() }">邮箱注册</RouterLink>
        <RouterLink :to="{ name: 'auth-forgot', query: queryCarry() }">忘记密码</RouterLink>
      </div>
      <p class="hint">Apple / Google 将由宿主 App 原生换票，本页暂提供邮箱路径。</p>
    </div>
  </div>
</template>

<style scoped>
.lead {
  margin: 8px 0 20px;
  color: var(--color-text-secondary);
  font-size: 14px;
}
.field {
  display: block;
  margin-bottom: 14px;
}
.label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-sizing: border-box;
}
.primary-btn {
  width: 100%;
  height: 48px;
  margin-top: 8px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
.primary-btn:disabled {
  opacity: 0.6;
}
.primary-btn:active:not(:disabled) {
  background: var(--color-primary-pressed);
}
.links {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 14px;
  color: var(--color-chip-active-text);
}
.hint {
  margin-top: 24px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
</style>
