import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import * as authApi from '@/api/auth'
import type { LoginCredentials, User } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')

  let pendingInit: Promise<void> | null = null

  function init(): Promise<void> {
    pendingInit ??= authApi
      .me()
      .then((current) => {
        user.value = current
      })
      .catch(() => {
        user.value = null
      })
      .finally(() => {
        initialized.value = true
      })

    return pendingInit
  }

  async function login(credentials: LoginCredentials): Promise<void> {
    user.value = await authApi.login(credentials)
    initialized.value = true
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } finally {
      clear()
    }
  }

  function clear(): void {
    user.value = null
  }

  return { user, initialized, isAuthenticated, isAdmin, init, login, logout, clear }
})
