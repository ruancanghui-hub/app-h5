<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppNavBar from '@/components/AppNavBar.vue'
import { registerAccount } from '@/api/identity'
import { useAuthFlow } from '@/composables/useAuthFlow'
import { useToast } from '@/composables/useToast'
import { isValidEmail } from '@/utils/validate'

const router = useRouter()
const { show } = useToast()
const { clientId, redirectUri, state, saveLoginTicket } = useAuthFlow()

const email = ref('')
const password = ref('')
const displayName = ref('')
const submitting = ref(false)

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
    const result = await registerAccount({
      email: email.value.trim(),
      password: password.value,
      displayName: displayName.value.trim() || undefined,
    })
    saveLoginTicket(result.loginTicket)
    if (result.emailVerifyToken) {
      show('注册成功（开发态验证码已打日志）')
    }
    await router.push({
      name: 'auth-consent',
      query: {
        client_id: clientId.value,
        ...(redirectUri.value ? { redirect_uri: redirectUri.value } : {}),
        ...(state.value ? { state: state.value } : {}),
      },
    })
  } catch (err) {
    show(err instanceof Error ? err.message : '注册失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page auth-page">
    <AppNavBar title="邮箱注册" @back="onBack" />
    <div class="page-body">
      <p class="lead">创建跨 App 共享的 Identity；显示名可选，缺省用邮箱前缀。</p>
      <label class="field">
        <span class="label">邮箱</span>
        <input v-model="email" class="input" type="email" autocomplete="username" placeholder="name@example.com" />
      </label>
      <label class="field">
        <span class="label">密码</span>
        <input v-model="password" class="input" type="password" autocomplete="new-password" placeholder="至少 8 位" />
      </label>
      <label class="field">
        <span class="label">显示名（可选）</span>
        <input v-model="displayName" class="input" type="text" maxlength="32" placeholder="不填则用邮箱前缀" />
      </label>
      <button class="primary-btn" type="button" :disabled="submitting" @click="onSubmit">
        {{ submitting ? '注册中…' : '注册并继续' }}
      </button>
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
