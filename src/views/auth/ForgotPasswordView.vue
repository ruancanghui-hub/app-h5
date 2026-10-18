<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNavBar from '@/components/AppNavBar.vue'
import { forgotPassword, resetPassword } from '@/api/identity'
import { useAuthFlow } from '@/composables/useAuthFlow'
import { useToast } from '@/composables/useToast'
import { isValidEmail } from '@/utils/validate'

const router = useRouter()
const route = useRoute()
const { show } = useToast()
const { clientId, redirectUri, state } = useAuthFlow()

const step = ref<'request' | 'reset'>('request')
const email = ref('')
const resetToken = ref('')
const newPassword = ref('')
const submitting = ref(false)

onMounted(() => {
  const token = route.query.token
  if (typeof token === 'string' && token) {
    resetToken.value = token
    step.value = 'reset'
  }
})

async function onBack() {
  if (step.value === 'reset') {
    step.value = 'request'
    return
  }
  await router.push({
    name: 'auth-login',
    query: {
      client_id: clientId.value,
      ...(redirectUri.value ? { redirect_uri: redirectUri.value } : {}),
      ...(state.value ? { state: state.value } : {}),
    },
  })
}

async function onRequest() {
  if (submitting.value) return
  if (!isValidEmail(email.value.trim())) {
    show('请输入正确的邮箱')
    return
  }
  submitting.value = true
  try {
    const result = await forgotPassword(email.value.trim())
    if (result.resetToken) {
      resetToken.value = result.resetToken
      show('开发态已回传重置凭证')
    } else {
      show('若邮箱已注册，将收到重置指引')
    }
    step.value = 'reset'
  } catch (err) {
    show(err instanceof Error ? err.message : '请求失败')
  } finally {
    submitting.value = false
  }
}

async function onReset() {
  if (submitting.value) return
  if (!resetToken.value.trim()) {
    show('请填写重置凭证')
    return
  }
  if (newPassword.value.length < 8) {
    show('新密码至少 8 位')
    return
  }
  submitting.value = true
  try {
    await resetPassword({
      token: resetToken.value.trim(),
      newPassword: newPassword.value,
    })
    show('密码已更新，请重新登录')
    await router.replace({
      name: 'auth-login',
      query: {
        client_id: clientId.value,
        ...(redirectUri.value ? { redirect_uri: redirectUri.value } : {}),
        ...(state.value ? { state: state.value } : {}),
      },
    })
  } catch (err) {
    show(err instanceof Error ? err.message : '重置失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page auth-page">
    <AppNavBar title="找回密码" @back="onBack" />
    <div class="page-body">
      <template v-if="step === 'request'">
        <p class="lead">输入注册邮箱，获取重置凭证（生产环境将发邮件）。</p>
        <label class="field">
          <span class="label">邮箱</span>
          <input v-model="email" class="input" type="email" placeholder="name@example.com" />
        </label>
        <button class="primary-btn" type="button" :disabled="submitting" @click="onRequest">
          {{ submitting ? '提交中…' : '发送重置指引' }}
        </button>
      </template>
      <template v-else>
        <p class="lead">填写重置凭证与新密码。改密后将撤销全部会话。</p>
        <label class="field">
          <span class="label">重置凭证</span>
          <input v-model="resetToken" class="input" type="text" placeholder="pr_…" />
        </label>
        <label class="field">
          <span class="label">新密码</span>
          <input v-model="newPassword" class="input" type="password" autocomplete="new-password" placeholder="至少 8 位" />
        </label>
        <button class="primary-btn" type="button" :disabled="submitting" @click="onReset">
          {{ submitting ? '提交中…' : '设置新密码' }}
        </button>
      </template>
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
</style>
