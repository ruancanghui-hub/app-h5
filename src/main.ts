import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/base.css'

const app = createApp(App)
app.use(router)
app.mount('#app')

const boot = document.getElementById('app-boot')
if (boot) {
  requestAnimationFrame(() => {
    boot.classList.add('is-hide')
    window.setTimeout(() => boot.remove(), 220)
  })
}
