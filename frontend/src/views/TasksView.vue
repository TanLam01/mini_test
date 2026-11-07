<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'

import { getErrorMessage } from '@/api/errors'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import TaskForm from '@/components/TaskForm.vue'
import TaskStatusChip from '@/components/TaskStatusChip.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useAssignees } from '@/composables/useAssignees'
import { useDeleteTask, useTaskStatsQuery, useTasksQuery } from '@/queries/tasks'
import { useAuthStore } from '@/stores/auth'
import { useNotifyStore } from '@/stores/notify'
import type { Task, TaskFilters, TaskStatus } from '@/types/api'
import { dueState, formatDate } from '@/utils/date'
import { isTaskStatus, TASK_STATUS_META, TASK_STATUS_OPTIONS } from '@/utils/taskStatus'

const PER_PAGE_OPTIONS = [10, 25, 50, 100]

const auth = useAuthStore()
const notify = useNotifyStore()
const route = useRoute()
const router = useRouter()
const { users, loading: usersLoading } = useAssignees()

function positiveInt(value: LocationQuery[string] | undefined): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const filters = reactive<{ status: TaskStatus | null; search: string; assignedTo: number | null }>({
  status: isTaskStatus(route.query.status) ? route.query.status : null,
  search: typeof route.query.search === 'string' ? route.query.search : '',
  assignedTo: positiveInt(route.query.assigned_to),
})
const page = ref(positiveInt(route.query.page) ?? 1)
const perPageFromUrl = positiveInt(route.query.per_page)
const perPage = ref(
  perPageFromUrl && PER_PAGE_OPTIONS.includes(perPageFromUrl) ? perPageFromUrl : 10,
)
const searchInput = ref<string | null>(filters.search)

const queryFilters = computed<TaskFilters>(() => ({
  status: filters.status,
  search: filters.search || null,
  assigned_to: filters.assignedTo,
  page: page.value,
  per_page: perPage.value,
}))

const tasksQuery = useTasksQuery(queryFilters)
const statsQuery = useTaskStatsQuery(() => filters.assignedTo)
const deleteMutation = useDeleteTask()

const tasks = computed(() => tasksQuery.data.value?.data ?? [])
const total = computed(() => tasksQuery.data.value?.meta.total ?? 0)
const loadError = computed(() =>
  tasksQuery.isError.value ? getErrorMessage(tasksQuery.error.value, 'Could not load tasks.') : '',
)
const hasActiveFilters = computed(() =>
  Boolean(filters.status || filters.search || filters.assignedTo),
)

const statCards = computed(() => {
  const stats = statsQuery.data.value
  const card = (status: TaskStatus, tone: string) => ({
    key: status,
    label: TASK_STATUS_META[status].label,
    icon: TASK_STATUS_META[status].icon,
    tone,
    value: stats?.[status],
  })

  return [
    {
      key: null,
      label: 'All tasks',
      icon: 'mdi-format-list-bulleted',
      tone: 'bg-indigo-50 text-indigo-600',
      value: stats?.all,
    },
    card('todo', 'bg-slate-100 text-slate-600'),
    card('in_progress', 'bg-blue-50 text-blue-600'),
    card('done', 'bg-green-50 text-green-600'),
  ]
})

const assigneeOptions = computed(() =>
  users.value.map((user) => ({ value: user.id, title: user.name })),
)

const headers = [
  { title: 'Task', key: 'title', sortable: false },
  { title: 'Assignee', key: 'assignee', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Due date', key: 'due_date', sortable: false },
  { title: '', key: 'actions', sortable: false, align: 'end' as const, width: 104 },
]

const createOpen = ref(false)
const taskToDelete = ref<Task | null>(null)
const deleteOpen = computed({
  get: () => taskToDelete.value !== null,
  set: (open) => {
    if (!open) taskToDelete.value = null
  },
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filters.search = value?.trim() ?? ''
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

watch([() => filters.status, () => filters.search, () => filters.assignedTo, perPage], () => {
  page.value = 1
})

watch(
  () => tasksQuery.data.value?.meta,
  (meta) => {
    if (meta && page.value > 1 && meta.last_page < page.value) {
      page.value = Math.max(1, meta.last_page)
    }
  },
)

watch(
  queryFilters,
  (current) => {
    const query: Record<string, string> = {}
    if (current.status) query.status = current.status
    if (current.search) query.search = current.search
    if (current.assigned_to) query.assigned_to = String(current.assigned_to)
    if (page.value > 1) query.page = String(page.value)
    if (perPage.value !== 10) query.per_page = String(perPage.value)

    void router.replace({ query })
  },
  { immediate: true },
)

function clearFilters(): void {
  clearTimeout(searchTimer)
  searchInput.value = ''
  filters.search = ''
  filters.status = null
  filters.assignedTo = null
}

function onCreated(task: Task): void {
  createOpen.value = false
  page.value = 1
  notify.show(`Task "${task.title}" created.`)
}

async function confirmDelete(): Promise<void> {
  if (!taskToDelete.value) return

  const { id, title } = taskToDelete.value
  try {
    await deleteMutation.mutateAsync(id)
    taskToDelete.value = null
    notify.show(`Task "${title}" deleted.`)
  } catch (error) {
    notify.show(getErrorMessage(error, 'Could not delete the task.'), 'error')
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Tasks</h1>
        <p class="mt-1 text-sm text-slate-500">
          {{ auth.isAdmin ? 'Everything your team is working on.' : 'Tasks assigned to you.' }}
        </p>
      </div>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        data-test="new-task"
        @click="createOpen = true"
      >
        New task
      </v-btn>
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <button
        v-for="card in statCards"
        :key="card.label"
        type="button"
        class="flex cursor-pointer items-center gap-4 rounded-lg border bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm"
        :class="
          filters.status === card.key
            ? 'border-indigo-500 ring-4 ring-indigo-500/10'
            : 'border-slate-200'
        "
        :aria-pressed="filters.status === card.key"
        :data-test="`stat-${card.key ?? 'all'}`"
        @click="filters.status = card.key"
      >
        <span class="grid size-10 shrink-0 place-items-center rounded-lg" :class="card.tone">
          <v-icon :icon="card.icon" size="20" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-xs font-medium text-slate-500">{{ card.label }}</span>
          <span class="block text-2xl font-semibold text-slate-900 tabular-nums">
            {{ card.value ?? '–' }}
          </span>
        </span>
      </button>
    </div>

    <v-card>
      <div class="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <div class="w-full sm:w-72">
          <v-text-field
            v-model="searchInput"
            label="Search by title"
            prepend-inner-icon="mdi-magnify"
            density="compact"
            clearable
            hide-details
            data-test="search"
          />
        </div>
        <div class="w-full sm:w-44">
          <v-select
            v-model="filters.status"
            label="Status"
            :items="TASK_STATUS_OPTIONS"
            density="compact"
            clearable
            hide-details
            data-test="status-filter"
          />
        </div>
        <div v-if="auth.isAdmin" class="w-full sm:w-52">
          <v-select
            v-model="filters.assignedTo"
            label="Assignee"
            :items="assigneeOptions"
            :loading="usersLoading"
            density="compact"
            clearable
            hide-details
            data-test="assignee-filter"
          />
        </div>
        <v-btn
          v-if="hasActiveFilters"
          variant="text"
          size="small"
          prepend-icon="mdi-filter-remove-outline"
          @click="clearFilters"
        >
          Clear filters
        </v-btn>
        <v-spacer />
        <span class="text-sm text-slate-500 tabular-nums">{{ total }} results</span>
      </div>

      <v-alert v-if="loadError" type="error" variant="tonal" class="m-4!" :text="loadError">
        <template #append>
          <v-btn variant="text" size="small" @click="tasksQuery.refetch()">Retry</v-btn>
        </template>
      </v-alert>

      <v-data-table-server
        v-model:page="page"
        v-model:items-per-page="perPage"
        :headers="headers"
        :items="tasks"
        :items-length="total"
        :items-per-page-options="PER_PAGE_OPTIONS"
        :loading="tasksQuery.isFetching.value"
        item-value="id"
        mobile-breakpoint="sm"
        hover
      >
        <template #loading>
          <v-skeleton-loader type="table-row@5" />
        </template>

        <template #[`item.title`]="{ item }">
          <div class="max-w-md py-3">
            <router-link
              :to="{ name: 'task-detail', params: { id: item.id } }"
              class="font-medium text-slate-900 no-underline hover:text-indigo-600"
            >
              {{ item.title }}
            </router-link>
            <p v-if="item.description" class="mt-0.5 line-clamp-1 text-xs text-slate-500">
              {{ item.description }}
            </p>
          </div>
        </template>

        <template #[`item.assignee`]="{ item }">
          <div v-if="item.assignee" class="flex items-center gap-2">
            <UserAvatar :name="item.assignee.name" :size="28" />
            <span class="text-sm text-slate-700">{{ item.assignee.name }}</span>
          </div>
          <span v-else class="text-slate-400">—</span>
        </template>

        <template #[`item.status`]="{ item }">
          <TaskStatusChip :status="item.status" />
        </template>

        <template #[`item.due_date`]="{ item }">
          <div v-if="item.due_date" class="flex items-center gap-2">
            <span
              class="text-sm tabular-nums"
              :class="
                dueState(item.due_date, item.status === 'done') === 'overdue'
                  ? 'font-medium text-red-600'
                  : 'text-slate-700'
              "
            >
              {{ formatDate(item.due_date) }}
            </span>
            <v-chip
              v-if="dueState(item.due_date, item.status === 'done') === 'overdue'"
              size="x-small"
              color="error"
              variant="tonal"
            >
              Overdue
            </v-chip>
            <v-chip
              v-else-if="dueState(item.due_date, item.status === 'done') === 'today'"
              size="x-small"
              color="warning"
              variant="tonal"
            >
              Today
            </v-chip>
          </div>
          <span v-else class="text-slate-400">—</span>
        </template>

        <template #[`item.actions`]="{ item }">
          <div class="flex justify-end gap-1">
            <v-tooltip text="Edit">
              <template #activator="{ props: tooltip }">
                <v-btn
                  v-bind="tooltip"
                  icon="mdi-pencil-outline"
                  variant="text"
                  size="small"
                  :aria-label="`Edit ${item.title}`"
                  :to="{ name: 'task-detail', params: { id: item.id } }"
                />
              </template>
            </v-tooltip>
            <v-tooltip text="Delete">
              <template #activator="{ props: tooltip }">
                <v-btn
                  v-bind="tooltip"
                  icon="mdi-trash-can-outline"
                  variant="text"
                  size="small"
                  color="error"
                  :aria-label="`Delete ${item.title}`"
                  @click="taskToDelete = item"
                />
              </template>
            </v-tooltip>
          </div>
        </template>

        <template #no-data>
          <div class="flex flex-col items-center py-14 text-center">
            <span class="grid size-14 place-items-center rounded-full bg-slate-100 text-slate-400">
              <v-icon icon="mdi-clipboard-text-search-outline" size="28" />
            </span>
            <h3 class="mt-4 text-base font-semibold text-slate-900">No tasks found</h3>
            <p class="mt-1 max-w-xs text-sm text-slate-500">
              {{
                hasActiveFilters
                  ? 'Nothing matches the current filters. Try adjusting or clearing them.'
                  : 'Create your first task to get started.'
              }}
            </p>
            <v-btn
              v-if="hasActiveFilters"
              class="mt-4"
              variant="tonal"
              color="primary"
              @click="clearFilters"
            >
              Clear filters
            </v-btn>
            <v-btn
              v-else
              class="mt-4"
              color="primary"
              prepend-icon="mdi-plus"
              @click="createOpen = true"
            >
              New task
            </v-btn>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <v-dialog v-model="createOpen" max-width="600">
      <v-card>
        <div class="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">New task</h2>
            <p class="text-sm text-slate-500">Fill in the details below.</p>
          </div>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            aria-label="Close"
            @click="createOpen = false"
          />
        </div>
        <v-card-text class="px-6! pt-4! pb-6!">
          <TaskForm
            v-if="createOpen"
            :users="users"
            :default-assignee-id="auth.user?.id"
            :lock-assignee="!auth.isAdmin"
            @saved="onCreated"
            @cancel="createOpen = false"
          />
        </v-card-text>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      v-model="deleteOpen"
      title="Delete task?"
      :text="`“${taskToDelete?.title ?? ''}” will be removed from the list.`"
      confirm-text="Delete"
      :loading="deleteMutation.isPending.value"
      @confirm="confirmDelete"
    />
  </div>
</template>
