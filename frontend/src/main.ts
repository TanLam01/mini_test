import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { setUnauthorizedHandler } from './api/http'
import vuetify from './plugins/vuetify'
import router from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

setUnauthorizedHandler(() => {
  useAuthStore().clear()

  const current = router.currentRoute.value
  if (current.meta.requiresAuth) {
    void router.replace({ name: 'login', query: { redirect: current.fullPath } })
  }
})

app.mount('#app')
