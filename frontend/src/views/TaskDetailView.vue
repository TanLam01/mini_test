<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'

import { getErrorMessage, getStatus } from '@/api/errors'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import TaskForm from '@/components/TaskForm.vue'
import TaskStatusChip from '@/components/TaskStatusChip.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useAssignees } from '@/composables/useAssignees'
import { useDeleteTask, useTaskQuery } from '@/queries/tasks'
import { useAuthStore } from '@/stores/auth'
import { useNotifyStore } from '@/stores/notify'
import type { Task } from '@/types/api'
import { dueState, formatDate, formatDateTime } from '@/utils/date'

const props = defineProps<{ id: number }>()

const auth = useAuthStore()
const notify = useNotifyStore()
const router = useRouter()
const { users } = useAssignees()

const taskQuery = useTaskQuery(() => props.id)
const deleteMutation = useDeleteTask()
const deleteOpen = ref(false)

const task = computed(() => taskQuery.data.value ?? null)

const loadError = computed(() => {
  if (!taskQuery.isError.value) {
    return null
  }

  const status = getStatus(taskQuery.error.value)
  if (status === 404) {
    return {
      icon: 'mdi-file-hidden',
      title: 'Task not found',
      text: 'This task does not exist or has been deleted.',
    }
  }
  if (status === 403) {
    return {
      icon: 'mdi-lock-outline',
      title: 'No access',
      text: 'You do not have permission to view this task.',
    }
  }

  return {
    icon: 'mdi-alert-circle-outline',
    title: 'Something went wrong',
    text: getErrorMessage(taskQuery.error.value, 'Could not load the task.'),
  }
})

const due = computed(() =>
  task.value ? dueState(task.value.due_date, task.value.status === 'done') : null,
)

const previous = router.options.history.state.back
const listLocation: RouteLocationRaw =
  typeof previous === 'string' && /^\/tasks(\?|$)/.test(previous) ? previous : { name: 'tasks' }

function onSaved(saved: Task): void {
  notify.show(`Task "${saved.title}" saved.`)
  void router.push(listLocation)
}

function backToList(): void {
  void router.push(listLocation)
}

async function confirmDelete(): Promise<void> {
  if (!task.value) return

  const { id, title } = task.value
  try {
    await deleteMutation.mutateAsync(id)
    deleteOpen.value = false
    notify.show(`Task "${title}" deleted.`)
    void router.push(listLocation)
  } catch (error) {
    notify.show(getErrorMessage(error, 'Could not delete the task.'), 'error')
  }
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="taskQuery.isPending.value">
      <div class="grid gap-6 lg:grid-cols-3">
        <v-card class="lg:col-span-2"
          ><v-skeleton-loader type="article, article, actions"
        /></v-card>
        <v-card><v-skeleton-loader type="list-item-avatar-two-line@4" /></v-card>
      </div>
    </template>

    <v-card v-else-if="loadError" class="mx-auto max-w-lg">
      <div class="flex flex-col items-center px-6 py-12 text-center">
        <span class="grid size-14 place-items-center rounded-full bg-slate-100 text-slate-500">
          <v-icon :icon="loadError.icon" size="28" />
        </span>
        <h1 class="mt-4 text-lg font-semibold text-slate-900">{{ loadError.title }}</h1>
        <p class="mt-1 text-sm text-slate-500" data-test="detail-error">{{ loadError.text }}</p>
        <v-btn
          class="mt-6"
          variant="tonal"
          color="primary"
          prepend-icon="mdi-arrow-left"
          @click="backToList"
        >
          Back to tasks
        </v-btn>
      </div>
    </v-card>

    <template v-else-if="task">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="truncate text-2xl font-semibold tracking-tight text-slate-900">
              {{ task.title }}
            </h1>
            <TaskStatusChip :status="task.status" />
          </div>
          <p class="mt-1 text-sm text-slate-500">Task #{{ task.id }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <v-btn
            variant="outlined"
            prepend-icon="mdi-arrow-left"
            :to="listLocation"
            data-test="back-to-list"
          >
            Back to tasks
          </v-btn>
          <v-btn
            variant="outlined"
            color="error"
            prepend-icon="mdi-trash-can-outline"
            @click="deleteOpen = true"
          >
            Delete
          </v-btn>
        </div>
      </div>

      <div class="grid items-start gap-6 lg:grid-cols-3">
        <v-card class="lg:col-span-2">
          <div class="border-b border-slate-200 px-6 py-4">
            <h2 class="text-base font-semibold text-slate-900">Edit task</h2>
            <p class="text-sm text-slate-500">Changes are saved when you click “Save changes”.</p>
          </div>
          <div class="p-6">
            <TaskForm
              :task="task"
              :users="users"
              :lock-assignee="!auth.isAdmin"
              @saved="onSaved"
              @cancel="backToList"
            />
          </div>
        </v-card>

        <v-card>
          <div class="border-b border-slate-200 px-6 py-4">
            <h2 class="text-base font-semibold text-slate-900">Details</h2>
          </div>
          <dl class="divide-y divide-slate-100 px-6">
            <div class="flex items-center justify-between gap-4 py-3.5">
              <dt class="text-sm text-slate-500">Assignee</dt>
              <dd
                v-if="task.assignee"
                class="flex items-center gap-2 text-sm font-medium text-slate-900"
              >
                <UserAvatar :name="task.assignee.name" :size="24" />
                {{ task.assignee.name }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3.5">
              <dt class="text-sm text-slate-500">Status</dt>
              <dd><TaskStatusChip :status="task.status" /></dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3.5">
              <dt class="text-sm text-slate-500">Due date</dt>
              <dd
                class="text-sm font-medium"
                :class="due === 'overdue' ? 'text-red-600' : 'text-slate-900'"
              >
                {{ task.due_date ? formatDate(task.due_date) : '—' }}
                <span v-if="due === 'overdue'" class="ml-1 text-xs font-normal">(overdue)</span>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3.5">
              <dt class="text-sm text-slate-500">Created</dt>
              <dd class="text-sm text-slate-900">{{ formatDateTime(task.created_at) || '—' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3.5">
              <dt class="text-sm text-slate-500">Last updated</dt>
              <dd class="text-sm text-slate-900">{{ formatDateTime(task.updated_at) || '—' }}</dd>
            </div>
          </dl>
        </v-card>
      </div>

      <ConfirmDialog
        v-model="deleteOpen"
        title="Delete task?"
        :text="`“${task.title}” will be removed from the list.`"
        confirm-text="Delete"
        :loading="deleteMutation.isPending.value"
        @confirm="confirmDelete"
      />
    </template>
  </div>
</template>
