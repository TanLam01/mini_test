<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { VForm } from 'vuetify/components'

import { getErrorMessage, getValidationErrors } from '@/api/errors'
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

const rules = {
  required: (value: string) => !!value || 'This field is required.',
  email: (value: string) => /.+@.+\..+/.test(value) || 'Enter a valid email address.',
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
  <v-row justify="center" class="mt-md-12">
    <v-col cols="12" sm="8" md="5" lg="4">
      <v-card elevation="4" class="pa-2">
        <v-card-title class="text-h5 d-flex align-center ga-2">
          <v-icon icon="mdi-format-list-checks" color="primary" />
          Team Task Manager
        </v-card-title>
        <v-card-subtitle>Sign in to continue</v-card-subtitle>

        <v-card-text>
          <v-alert
            v-if="errorMessage"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-4"
            :text="errorMessage"
          />

          <v-form ref="form" @submit.prevent="submit">
            <v-text-field
              v-model="credentials.email"
              label="Email"
              type="email"
              autocomplete="username"
              prepend-inner-icon="mdi-email-outline"
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
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              :rules="[rules.required]"
              :error-messages="fieldErrors.password"
              class="mt-2"
              @click:append-inner="showPassword = !showPassword"
            />
            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              class="mt-4"
              :loading="submitting"
            >
              Sign in
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
