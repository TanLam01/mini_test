import '@fontsource-variable/inter'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'

import App from './App.vue'
import { setUnauthorizedHandler } from './api/http'
import { queryClient } from './plugins/query'
import vuetify from './plugins/vuetify'
import router from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

app.use(createPinia())
app.use(VueQueryPlugin, { queryClient })
app.use(router)
app.use(vuetify)

setUnauthorizedHandler(() => {
  useAuthStore().clear()

  const current = router.currentRoute.value
  if (current.meta.requiresAuth) {
    void router.replace({ name: 'login', query: { redirect: current.fullPath } })
  }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Team Task Manager` : 'Team Task Manager'
})

app.mount('#app')
