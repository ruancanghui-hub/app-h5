<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppNavBar from '@/components/AppNavBar.vue'
import TypeChips from '@/components/TypeChips.vue'
import ImageUploader, { type UploadItem } from '@/components/ImageUploader.vue'
import { bridge } from '@/bridge'
import { submitFeedback, type ProblemType } from '@/api/feedback'
import { countTextLength, isValidContact } from '@/utils/validate'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const { show } = useToast()

const TYPE_OPTIONS: { value: ProblemType; label: string }[] = [
  { value: 'abnormal', label: '功能异常' },
  { value: 'suggestion', label: '意见与建议' },
  { value: 'other', label: '其他' },
]

const problemType = ref<ProblemType>('abnormal')
const content = ref('')
const contact = ref('')
const images = ref<UploadItem[]>([])
const submitting = ref(false)

const contentLen = computed(() => countTextLength(content.value))
const canSubmit = computed(() => !submitting.value)

async function onBack() {
  await bridge.closePage()
}

async function onHistory() {
  try {
    await bridge.openHistory()
  } catch {
    await router.push({ name: 'feedback-history' })
  }
}

async function onSubmit() {
  if (submitting.value) return

  if (contentLen.value < 10) {
    show('请至少用 10 个字描述问题')
    return
  }
  if (contentLen.value > 500) {
    show('描述不能超过 500 字')
    return
  }
  if (!isValidContact(contact.value)) {
    show('请输入正确的手机号或邮箱')
    return
  }

  submitting.value = true
  try {
    await submitFeedback({
      problemType: problemType.value,
      content: content.value.trim(),
      contact: contact.value.trim() || undefined,
      images: images.value.map((i) => i.file),
    })
    show('提交成功', 1000)
    window.setTimeout(() => {
      void bridge.closePage()
    }, 1000)
  } catch (err) {
    show(err instanceof Error ? err.message : '提交失败，请重试')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page feedback-page">
    <AppNavBar title="意见与建议" @back="onBack" @action="onHistory">
      <template #action>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path
            d="M12 8v4.2l2.6 1.6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M16.8 6.2A8.2 8.2 0 0 0 7 5.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <path
            d="M7.2 3.8v2.2H9.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </template>
    </AppNavBar>

    <div class="page-body">
      <section class="field">
        <div class="label">
          <span class="required">*</span>问题类型：
        </div>
        <TypeChips v-model="problemType" :options="TYPE_OPTIONS" />
      </section>

      <section class="field">
        <div class="label">
          <span class="required">*</span>问题描述或建议
        </div>
        <div class="textarea-wrap">
          <textarea
            v-model="content"
            maxlength="500"
            rows="6"
            placeholder="请至少用 10 个字描述问题，并添加截图，这有助于问题快速解决。"
          />
          <div class="counter">{{ contentLen }}/500</div>
        </div>
      </section>

      <section class="field">
        <ImageUploader v-model="images" :max-count="3" />
      </section>

      <section class="field">
        <div class="label">联系方式：</div>
        <input
          v-model="contact"
          class="input"
          type="text"
          inputmode="email"
          maxlength="64"
          placeholder="请输入手机号或邮箱"
          autocomplete="off"
        />
      </section>
    </div>

    <div class="footer">
      <button
        class="submit"
        type="button"
        :disabled="!canSubmit"
        :class="{ disabled: !canSubmit }"
        @click="onSubmit"
      >
        {{ submitting ? '提交中...' : '提交' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.feedback-page {
  padding-bottom: calc(88px + var(--safe-bottom));
}

.field {
  margin-bottom: 20px;
}

.label {
  margin-bottom: 10px;
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
}

.required {
  color: var(--color-danger);
  margin-right: 2px;
}

.textarea-wrap {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 12px 12px 28px;
}

.textarea-wrap textarea {
  width: 100%;
  min-height: 120px;
  background: transparent;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.55;
  user-select: text;
}

.textarea-wrap textarea::placeholder {
  color: #b0b0b0;
}

.counter {
  position: absolute;
  right: 12px;
  bottom: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: 14px;
  user-select: text;
}

.input::placeholder {
  color: #b0b0b0;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 24px calc(12px + var(--safe-bottom));
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #fff 28%);
}

.submit {
  width: 100%;
  height: 46px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.submit:active:not(.disabled) {
  background: var(--color-primary-pressed);
}

.submit.disabled {
  opacity: 0.55;
}
</style>
