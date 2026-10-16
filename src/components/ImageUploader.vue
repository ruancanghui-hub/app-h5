<script setup lang="ts">
import { bridge } from '@/bridge'
import { compressImage } from '@/utils/compressImage'
import { useToast } from '@/composables/useToast'

export interface UploadItem {
  id: string
  previewUrl: string
  file: File
}

const props = withDefaults(
  defineProps<{
    modelValue: UploadItem[]
    maxCount?: number
    maxBytes?: number
  }>(),
  {
    maxCount: 3,
    maxBytes: 5 * 1024 * 1024,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: UploadItem[]]
}>()

const { show } = useToast()

async function onAdd() {
  const remain = props.maxCount - props.modelValue.length
  if (remain <= 0) {
    show(`最多上传 ${props.maxCount} 张图片`)
    return
  }

  try {
    const picked = await bridge.pickImage({ maxCount: remain })
    if (!picked.length) return

    const next = [...props.modelValue]
    for (const item of picked) {
      let raw: File
      if (item.file) {
        raw = item.file
      } else {
        const blob = await fetch(item.url).then((r) => r.blob())
        raw = new File([blob], item.name || 'image.jpg', {
          type: blob.type || 'image/jpeg',
        })
      }

      if (!/^image\/(jpeg|png|webp)$/i.test(raw.type)) {
        show('仅支持 jpeg/png/webp')
        continue
      }
      if (raw.size > props.maxBytes) {
        show(`单张不能超过 ${Math.round(props.maxBytes / 1024 / 1024)}MB`)
        continue
      }

      const compressed = await compressImage(raw, { maxBytes: props.maxBytes })
      const previewUrl = URL.createObjectURL(compressed)
      next.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        previewUrl,
        file: compressed,
      })
    }
    emit('update:modelValue', next.slice(0, props.maxCount))
  } catch (err) {
    show(err instanceof Error ? err.message : '选择图片失败')
  }
}

function onRemove(id: string) {
  const target = props.modelValue.find((i) => i.id === id)
  if (target) URL.revokeObjectURL(target.previewUrl)
  emit(
    'update:modelValue',
    props.modelValue.filter((i) => i.id !== id),
  )
}
</script>

<template>
  <div class="uploader">
    <div v-for="item in modelValue" :key="item.id" class="thumb">
      <img :src="item.previewUrl" alt="截图预览" />
      <button class="remove" type="button" aria-label="删除图片" @click="onRemove(item.id)">
        ×
      </button>
    </div>
    <button
      v-if="modelValue.length < maxCount"
      class="add"
      type="button"
      aria-label="添加截图"
      @click="onAdd"
    >
      <span class="plus">+</span>
    </button>
  </div>
</template>

<style scoped>
.uploader {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.thumb,
.add {
  width: 88px;
  height: 88px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
  position: relative;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #bfbfbf;
}

.add:active {
  opacity: 0.8;
}

.plus {
  font-size: 36px;
  line-height: 1;
  font-weight: 300;
}

.remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
