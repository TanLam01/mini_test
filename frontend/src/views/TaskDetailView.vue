<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getErrorMessage, getStatus } from '@/api/errors'
import { getTask } from '@/api/tasks'
import TaskForm from '@/components/TaskForm.vue'
import TaskStatusChip from '@/components/TaskStatusChip.vue'
import { useAssignees } from '@/composables/useAssignees'
import { useAuthStore } from '@/stores/auth'
import { useNotifyStore } from '@/stores/notify'
import type { Task } from '@/types/api'

const props = defineProps<{ id: number }>()

const auth = useAuthStore()
const notify = useNotifyStore()
const router = useRouter()
const { users } = useAssignees()

const task = ref<Task | null>(null)
const loading = ref(true)
const loadError = ref('')

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  task.value = null

  try {
    task.value = await getTask(props.id)
  } catch (error) {
    const status = getStatus(error)
    loadError.value =
      status === 404
        ? 'This task does not exist or has been deleted.'
        : status === 403
          ? 'You do not have permission to view this task.'
          : getErrorMessage(error, 'Could not load the task.')
  } finally {
    loading.value = false
  }
}

watch(() => props.id, load, { immediate: true })

function onSaved(saved: Task): void {
  notify.show(`Task "${saved.title}" saved.`)
  void router.push({ name: 'tasks' })
}

function backToList(): void {
  void router.push({ name: 'tasks' })
}
</script>

<template>
  <v-row justify="center">
    <v-col cols="12" md="8" lg="6">
      <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-2" @click="backToList"
        >Back to tasks</v-btn
      >

      <v-card :loading="loading">
        <template v-if="loading">
          <v-skeleton-loader type="article, actions" />
        </template>

        <v-alert
          v-else-if="loadError"
          type="error"
          variant="tonal"
          class="ma-4"
          :text="loadError"
        />

        <template v-else-if="task">
          <v-card-title class="d-flex align-center ga-2 pt-4">
            <span class="text-h6">Edit task #{{ task.id }}</span>
            <TaskStatusChip :status="task.status" />
          </v-card-title>
          <v-card-subtitle v-if="task.updated_at">
            Last updated {{ new Date(task.updated_at).toLocaleString() }}
          </v-card-subtitle>

          <v-card-text>
            <TaskForm
              :task="task"
              :users="users"
              :lock-assignee="!auth.isAdmin"
              @saved="onSaved"
              @cancel="backToList"
            />
          </v-card-text>
        </template>
      </v-card>
    </v-col>
  </v-row>
</template>
