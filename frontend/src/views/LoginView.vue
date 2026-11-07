<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { VForm } from 'vuetify/components'

import { getErrorMessage, getValidationErrors } from '@/api/errors'
import AppLogo from '@/components/AppLogo.vue'
import { safeRedirectTarget } from '@/router/guard'
import { useAuthStore } from '@/stores/auth'
import type { ValidationErrors } from '@/types/api'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = ref<InstanceType<typeof VForm> | null>(null)
const credentials = reactive({ email: '', password: '' })
const fieldErrors = ref<ValidationErrors>({})
const errorMessage = ref('')
const submitting = ref(false)
const showPassword = ref(false)

const showDemoAccounts = import.meta.env.DEV
const demoAccounts = [
  { email: 'admin@example.com', label: 'Admin', icon: 'mdi-shield-account-outline' },
  { email: 'user1@example.com', label: 'User', icon: 'mdi-account-outline' },
]

const highlights = [
  { icon: 'mdi-view-dashboard-outline', text: 'See every task and its status at a glance' },
  { icon: 'mdi-filter-variant', text: 'Filter, search and page through large lists' },
  { icon: 'mdi-shield-lock-outline', text: 'Role-based access for admins and members' },
]

const rules = {
  required: (value: string) => !!value || 'This field is required.',
  email: (value: string) => /.+@.+\..+/.test(value) || 'Enter a valid email address.',
}

function useDemoAccount(email: string): void {
  credentials.email = email
  credentials.password = 'password'
  fieldErrors.value = {}
  errorMessage.value = ''
}

async function submit(): Promise<void> {
  const result = await form.value?.validate()
  if (!result?.valid) {
    return
  }

  submitting.value = true
  fieldErrors.value = {}
  errorMessage.value = ''

  try {
    await auth.login({ ...credentials })
    await router.replace(safeRedirectTarget(route.query.redirect))
  } catch (error) {
    const validation = getValidationErrors(error)
    if (validation) {
      fieldErrors.value = validation
    } else {
      errorMessage.value = getErrorMessage(error, 'Login failed. Please try again.')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
    <aside
      class="relative hidden flex-col justify-between overflow-hidden bg-indigo-600 p-12 text-white lg:flex"
    >
      <div class="absolute -top-24 -right-24 size-80 rounded-full bg-white/10" />
      <div class="absolute -bottom-32 -left-16 size-96 rounded-full bg-indigo-500/60" />

      <AppLogo inverted class="relative" />

      <div class="relative max-w-md">
        <h2 class="text-3xl leading-tight font-semibold">
          Plan, track and ship your team's work in one place.
        </h2>
        <ul class="mt-8 space-y-4">
          <li v-for="item in highlights" :key="item.text" class="flex items-center gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15">
              <v-icon :icon="item.icon" size="18" />
            </span>
            <span class="text-sm text-indigo-50">{{ item.text }}</span>
          </li>
        </ul>
      </div>

      <p class="relative text-xs text-indigo-200">Laravel 11 · Vue 3 · Vuetify 3</p>
    </aside>

    <main class="flex items-center justify-center bg-slate-50 px-6 py-12">
      <div class="w-full max-w-sm">
        <AppLogo class="mb-10 lg:hidden" />

        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        <p class="mt-1 text-sm text-slate-500">Sign in to your account to continue.</p>

        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-6"
          :text="errorMessage"
        />

        <v-form ref="form" class="mt-6 space-y-4" @submit.prevent="submit">
          <v-text-field
            v-model="credentials.email"
            label="Email"
            type="email"
            autocomplete="username"
            prepend-inner-icon="mdi-email-outline"
            bg-color="white"
            :rules="[rules.required, rules.email]"
            :error-messages="fieldErrors.email"
            @update:model-value="fieldErrors.email = undefined"
          />
          <v-text-field
            v-model="credentials.password"
            label="Password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            bg-color="white"
            :rules="[rules.required]"
            :error-messages="fieldErrors.password"
            @click:append-inner="showPassword = !showPassword"
          />
          <v-btn
            type="submit"
            color="primary"
            size="large"
            block
            :loading="submitting"
            data-test="sign-in"
          >
            Sign in
          </v-btn>
        </v-form>

        <div
          v-if="showDemoAccounts"
          class="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-4"
        >
          <div class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Demo accounts
          </div>
          <p class="mt-1 text-xs text-slate-500">
            Seeded users, password <code class="font-semibold text-slate-700">password</code>.
          </p>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <v-btn
              v-for="account in demoAccounts"
              :key="account.email"
              variant="tonal"
              color="primary"
              size="small"
              :prepend-icon="account.icon"
              @click="useDemoAccount(account.email)"
            >
              {{ account.label }}
            </v-btn>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
