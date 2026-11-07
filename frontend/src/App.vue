<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'

import AppLogo from '@/components/AppLogo.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotifyStore } from '@/stores/notify'

const auth = useAuthStore()
const notify = useNotifyStore()
const route = useRoute()
const router = useRouter()
const { mdAndUp } = useDisplay()

const drawer = ref<boolean | null>(null)
const loggingOut = ref(false)

const showShell = computed(() => auth.isAuthenticated && !route.meta.guestOnly)

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
    <template v-if="showShell">
      <v-navigation-drawer v-model="drawer" width="264" border="e" elevation="0">
        <div class="flex h-16 items-center px-5">
          <AppLogo />
        </div>

        <v-list nav density="comfortable" class="px-3" color="primary">
          <v-list-subheader class="text-xs! font-semibold! uppercase tracking-wider">
            Workspace
          </v-list-subheader>
          <v-list-item
            prepend-icon="mdi-format-list-checks"
            title="Tasks"
            rounded="lg"
            :to="{ name: 'tasks' }"
          />
        </v-list>

        <template #append>
          <div class="m-3 rounded-lg bg-indigo-50 p-4">
            <div class="text-sm font-semibold text-indigo-900">
              Signed in as {{ auth.user?.role }}
            </div>
            <p class="mt-1 text-xs leading-relaxed text-indigo-700">
              {{
                auth.isAdmin
                  ? 'You can see and manage every task in the team.'
                  : 'You can see and manage the tasks assigned to you.'
              }}
            </p>
          </div>
        </template>
      </v-navigation-drawer>

      <v-app-bar flat border="b" height="64">
        <v-app-bar-nav-icon
          v-if="!mdAndUp"
          aria-label="Toggle navigation"
          @click="drawer = !drawer"
        />
        <v-app-bar-title class="text-base! font-semibold!">{{ route.meta.title }}</v-app-bar-title>

        <template #append>
          <div class="mr-2 flex items-center gap-3">
            <UserAvatar v-if="auth.user" :name="auth.user.name" :size="34" />
            <div class="hidden leading-tight sm:block">
              <div class="text-sm font-semibold text-slate-900" data-test="current-user-name">
                {{ auth.user?.name }}
              </div>
              <div class="text-xs text-slate-500 capitalize" data-test="current-user-role">
                {{ auth.user?.role }}
              </div>
            </div>
            <v-chip
              class="sm:hidden!"
              size="x-small"
              color="primary"
              variant="tonal"
              data-test="current-user-role-chip"
            >
              {{ auth.user?.role }}
            </v-chip>
            <v-divider vertical class="mx-1 my-3" />
            <v-tooltip text="Log out">
              <template #activator="{ props: tooltip }">
                <v-btn
                  v-bind="tooltip"
                  icon="mdi-logout"
                  variant="text"
                  size="small"
                  aria-label="Log out"
                  :loading="loggingOut"
                  @click="logout"
                />
              </template>
            </v-tooltip>
          </div>
        </template>
      </v-app-bar>
    </template>

    <v-main>
      <div v-if="showShell" class="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <router-view />
      </div>
      <router-view v-else />
    </v-main>

    <v-snackbar
      v-model="notify.visible"
      :color="notify.color"
      timeout="3000"
      location="bottom right"
      rounded="lg"
    >
      <div class="flex items-center gap-2">
        <v-icon
          :icon="notify.color === 'error' ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline'"
          size="18"
        />
        {{ notify.message }}
      </div>
    </v-snackbar>
  </v-app>
</template>
