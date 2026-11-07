<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { useNotifyStore } from '@/stores/notify'

const auth = useAuthStore()
const notify = useNotifyStore()
const router = useRouter()

const drawer = ref<boolean | null>(null)
const loggingOut = ref(false)

async function logout(): Promise<void> {
  loggingOut.value = true
  try {
    await auth.logout()
  } finally {
    loggingOut.value = false
    await router.replace({ name: 'login' })
  }
}
</script>

<template>
  <v-app>
    <template v-if="auth.isAuthenticated">
      <v-app-bar color="primary" density="comfortable">
        <v-app-bar-nav-icon aria-label="Toggle navigation" @click="drawer = !drawer" />
        <v-app-bar-title>Team Task Manager</v-app-bar-title>

        <template #append>
          <div class="d-flex align-center ga-2 mr-2">
            <v-icon icon="mdi-account-circle" />
            <span class="text-body-2 d-none d-sm-inline" data-test="current-user-name">{{
              auth.user?.name
            }}</span>
            <v-chip size="small" variant="outlined" data-test="current-user-role">
              {{ auth.user?.role }}
            </v-chip>
            <v-btn
              icon="mdi-logout"
              variant="text"
              aria-label="Log out"
              :loading="loggingOut"
              @click="logout"
            />
          </div>
        </template>
      </v-app-bar>

      <v-navigation-drawer v-model="drawer">
        <v-list nav density="comfortable">
          <v-list-item
            prepend-icon="mdi-format-list-checks"
            title="Tasks"
            :to="{ name: 'tasks' }"
          />
        </v-list>
      </v-navigation-drawer>
    </template>

    <v-main>
      <v-container class="py-6" fluid>
        <router-view />
      </v-container>
    </v-main>

    <v-snackbar
      v-model="notify.visible"
      :color="notify.color"
      timeout="3000"
      location="bottom right"
    >
      {{ notify.message }}
    </v-snackbar>
  </v-app>
</template>
