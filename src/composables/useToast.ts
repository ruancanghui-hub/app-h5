import { reactive } from 'vue'

interface ToastState {
  visible: boolean
  message: string
  timer: ReturnType<typeof setTimeout> | null
}

const state = reactive<ToastState>({
  visible: false,
  message: '',
  timer: null,
})

export function useToast() {
  function show(message: string, duration = 1800) {
    if (state.timer) clearTimeout(state.timer)
    state.message = message
    state.visible = true
    state.timer = setTimeout(() => {
      state.visible = false
      state.timer = null
    }, duration)
  }

  return { state, show }
}
