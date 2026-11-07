<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { VForm } from 'vuetify/components'

import { getErrorMessage, getValidationErrors } from '@/api/errors'
import { createTask, updateTask } from '@/api/tasks'
import type { Task, TaskPayload, User, ValidationErrors } from '@/types/api'
import { parseIsoDate, toIsoDate } from '@/utils/date'
import { TASK_STATUS_OPTIONS } from '@/utils/taskStatus'

const props = withDefaults(
  defineProps<{
    task?: Task | null
    users: User[]
    defaultAssigneeId?: number | null
    lockAssignee?: boolean
  }>(),
  { task: null, defaultAssigneeId: null, lockAssignee: false },
)

const emit = defineEmits<{
  saved: [task: Task]
  cancel: []
}>()

const isEdit = computed(() => props.task !== null)

const formRef = ref<InstanceType<typeof VForm> | null>(null)
const form = reactive<TaskPayload>(initialState())
const fieldErrors = ref<ValidationErrors>({})
const errorMessage = ref('')
const submitting = ref(false)
const datePickerOpen = ref(false)

const rules = {
  required: (value: unknown) =>
    (value !== null && value !== undefined && value !== '') || 'This field is required.',
  max: (limit: number) => (value: string | null) =>
    !value || value.length <= limit || `Must be at most ${limit} characters.`,
}

const assigneeItems = computed(() =>
  props.users.map((user) => ({ value: user.id, title: user.name })),
)

const dueDate = computed<Date | null>({
  get: () => parseIsoDate(form.due_date),
  set: (value) => {
    form.due_date = value ? toIsoDate(value) : null
    datePickerOpen.value = false
  },
})

watch(
  () => props.task,
  () => {
    Object.assign(form, initialState())
    fieldErrors.value = {}
    errorMessage.value = ''
  },
)

function initialState(): TaskPayload {
  return {
    title: props.task?.title ?? '',
    description: props.task?.description ?? null,
    status: props.task?.status ?? 'todo',
    assigned_to: props.task?.assigned_to ?? props.defaultAssigneeId ?? props.users[0]?.id ?? 0,
    due_date: props.task?.due_date ?? null,
  }
}

function clearFieldError(field: keyof TaskPayload): void {
  fieldErrors.value[field] = undefined
}

async function submit(): Promise<void> {
  const result = await formRef.value?.validate()
  if (!result?.valid) {
    return
  }

  submitting.value = true
  fieldErrors.value = {}
  errorMessage.value = ''

  const payload: TaskPayload = { ...form, description: form.description?.trim() || null }

  try {
    const saved = props.task ? await updateTask(props.task.id, payload) : await createTask(payload)
    emit('saved', saved)
  } catch (error) {
    const validation = getValidationErrors(error)
    if (validation) {
      fieldErrors.value = validation
      errorMessage.value = 'Please fix the highlighted fields.'
    } else {
      errorMessage.value = getErrorMessage(error, 'Could not save the task.')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-form ref="formRef" @submit.prevent="submit">
    <v-alert
      v-if="errorMessage"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
      :text="errorMessage"
      data-test="form-error"
    />

    <v-text-field
      v-model="form.title"
      label="Title *"
      counter="255"
      :rules="[rules.required, rules.max(255)]"
      :error-messages="fieldErrors.title"
      data-test="title"
      @update:model-value="clearFieldError('title')"
    />

    <v-textarea
      v-model="form.description"
      label="Description"
      rows="3"
      auto-grow
      class="mt-2"
      :rules="[rules.max(5000)]"
      :error-messages="fieldErrors.description"
      @update:model-value="clearFieldError('description')"
    />

    <v-row class="mt-0">
      <v-col cols="12" sm="6">
        <v-select
          v-model="form.status"
          label="Status *"
          :items="TASK_STATUS_OPTIONS"
          :rules="[rules.required]"
          :error-messages="fieldErrors.status"
          data-test="status"
          @update:model-value="clearFieldError('status')"
        />
      </v-col>
      <v-col cols="12" sm="6">
        <v-select
          v-model="form.assigned_to"
          label="Assignee *"
          :items="assigneeItems"
          :readonly="lockAssignee"
          :hint="lockAssignee ? 'You can only assign tasks to yourself.' : undefined"
          :persistent-hint="lockAssignee"
          :rules="[rules.required]"
          :error-messages="fieldErrors.assigned_to"
          data-test="assignee"
          @update:model-value="clearFieldError('assigned_to')"
        />
      </v-col>
    </v-row>

    <v-menu v-model="datePickerOpen" :close-on-content-click="false" location="bottom start">
      <template #activator="{ props: activatorProps }">
        <v-text-field
          v-bind="activatorProps"
          :model-value="form.due_date"
          label="Due date"
          placeholder="YYYY-MM-DD"
          prepend-inner-icon="mdi-calendar"
          readonly
          clearable
          class="mt-2"
          :error-messages="fieldErrors.due_date"
          data-test="due-date"
          @click:clear="form.due_date = null"
        />
      </template>
      <v-date-picker v-model="dueDate" show-adjacent-months hide-header />
    </v-menu>

    <div class="d-flex justify-end ga-2 mt-4">
      <v-btn variant="text" :disabled="submitting" @click="emit('cancel')">Cancel</v-btn>
      <v-btn type="submit" color="primary" :loading="submitting" data-test="submit">
        {{ isEdit ? 'Save changes' : 'Create task' }}
      </v-btn>
    </div>
  </v-form>
</template>
