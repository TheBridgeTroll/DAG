import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
const app = createApp(App)
app.config.errorHandler = error => {
  console.error(error)
  const notice = document.getElementById('boot-error')
  if (notice) { notice.hidden = false; notice.textContent = `Błąd aplikacji: ${error.message}. Szczegóły w konsoli.` }
}
app.mount('#app')
