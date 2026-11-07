<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery } from 'vue-router'

import { getErrorMessage, isCanceled } from '@/api/errors'
import { deleteTask, listTasks } from '@/api/tasks'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import TaskForm from '@/components/TaskForm.vue'
import TaskStatusChip from '@/components/TaskStatusChip.vue'
import { useAssignees } from '@/composables/useAssignees'
import { useAuthStore } from '@/stores/auth'
import { useNotifyStore } from '@/stores/notify'
import type { Task, TaskStatus } from '@/types/api'
import { toIsoDate } from '@/utils/date'
import { isTaskStatus, TASK_STATUS_OPTIONS } from '@/utils/taskStatus'

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

// Trạng thái lọc/phân trang khởi tạo từ URL để reload hoặc chia sẻ link vẫn giữ nguyên.
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

const tasks = ref<Task[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')
let controller: AbortController | null = null

const createOpen = ref(false)
const taskToDelete = ref<Task | null>(null)
const deleting = ref(false)
const deleteOpen = computed({
  get: () => taskToDelete.value !== null,
  set: (open) => {
    if (!open) taskToDelete.value = null
  },
})

const headers = [
  { title: 'Title', key: 'title', sortable: false },
  { title: 'Assignee', key: 'assignee', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Due date', key: 'due_date', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' as const },
]

const assigneeOptions = computed(() =>
  users.value.map((user) => ({ value: user.id, title: user.name })),
)
const today = toIsoDate(new Date())

async function load(): Promise<void> {
  // Huỷ request cũ để response chậm của bộ lọc trước không ghi đè kết quả của bộ lọc mới.
  controller?.abort()
  const current = new AbortController()
  controller = current

  loading.value = true
  loadError.value = ''

  try {
    const result = await listTasks(
      {
        status: filters.status,
        search: filters.search,
        assigned_to: filters.assignedTo,
        page: page.value,
        per_page: perPage.value,
      },
      current.signal,
    )

    if (result.data.length === 0 && page.value > 1 && result.meta.last_page < page.value) {
      page.value = result.meta.last_page
      return
    }

    tasks.value = result.data
    total.value = result.meta.total
  } catch (error) {
    if (!isCanceled(error)) {
      loadError.value = getErrorMessage(error, 'Could not load tasks.')
    }
  } finally {
    if (controller === current) {
      loading.value = false
    }
  }
}

function syncQuery(): void {
  const query: Record<string, string> = {}
  if (filters.status) query.status = filters.status
  if (filters.search) query.search = filters.search
  if (filters.assignedTo) query.assigned_to = String(filters.assignedTo)
  if (page.value > 1) query.page = String(page.value)
  if (perPage.value !== 10) query.per_page = String(perPage.value)

  void router.replace({ query })
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filters.search = value?.trim() ?? ''
  }, 300)
})
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  controller?.abort()
})

// Phải khai báo trước watcher tải dữ liệu: Vue gộp hai lần thay đổi trong cùng tick thành một lần gọi API.
watch([() => filters.status, () => filters.search, () => filters.assignedTo, perPage], () => {
  page.value = 1
})

watch(
  [() => filters.status, () => filters.search, () => filters.assignedTo, page, perPage],
  () => {
    syncQuery()
    void load()
  },
  { immediate: true },
)

function onCreated(task: Task): void {
  createOpen.value = false
  notify.show(`Task "${task.title}" created.`)
  if (page.value === 1) {
    void load()
  } else {
    page.value = 1
  }
}

async function confirmDelete(): Promise<void> {
  if (!taskToDelete.value) return

  const { id, title } = taskToDelete.value
  deleting.value = true
  try {
    await deleteTask(id)
    tasks.value = tasks.value.filter((task) => task.id !== id)
    total.value = Math.max(0, total.value - 1)
    notify.show(`Task "${title}" deleted.`)
    taskToDelete.value = null
    await load()
  } catch (error) {
    notify.show(getErrorMessage(error, 'Could not delete the task.'), 'error')
  } finally {
    deleting.value = false
  }
}

function isOverdue(task: Task): boolean {
  return task.due_date !== null && task.due_date < today && task.status !== 'done'
}
</script>

<template>
  <v-card>
    <v-card-title class="d-flex flex-wrap align-center ga-2 pt-4">
      <span class="text-h6">Tasks</span>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        data-test="new-task"
        @click="createOpen = true"
      >
        New task
      </v-btn>
    </v-card-title>

    <v-card-text class="pb-0">
      <v-row dense>
        <v-col cols="12" md="5">
          <v-text-field
            v-model="searchInput"
            label="Search by title"
            prepend-inner-icon="mdi-magnify"
            clearable
            hide-details
            data-test="search"
          />
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-select
            v-model="filters.status"
            label="Status"
            :items="TASK_STATUS_OPTIONS"
            clearable
            hide-details
            data-test="status-filter"
          />
        </v-col>
        <v-col v-if="auth.isAdmin" cols="12" sm="6" md="4">
          <v-select
            v-model="filters.assignedTo"
            label="Assignee"
            :items="assigneeOptions"
            :loading="usersLoading"
            clearable
            hide-details
          />
        </v-col>
      </v-row>
    </v-card-text>

    <v-alert v-if="loadError" type="error" variant="tonal" class="ma-4" :text="loadError">
      <template #append>
        <v-btn variant="text" @click="load">Retry</v-btn>
      </template>
    </v-alert>

    <v-data-table-server
      v-model:page="page"
      v-model:items-per-page="perPage"
      :headers="headers"
      :items="tasks"
      :items-length="total"
      :items-per-page-options="PER_PAGE_OPTIONS"
      :loading="loading"
      loading-text="Loading tasks…"
      no-data-text="No tasks match your filters."
      item-value="id"
      mobile-breakpoint="sm"
      class="mt-2"
    >
      <template #[`item.title`]="{ item }">
        <router-link :to="{ name: 'task-detail', params: { id: item.id } }" class="text-primary">
          {{ item.title }}
        </router-link>
      </template>

      <template #[`item.assignee`]="{ item }">
        {{ item.assignee?.name ?? '—' }}
      </template>

      <template #[`item.status`]="{ item }">
        <TaskStatusChip :status="item.status" />
      </template>

      <template #[`item.due_date`]="{ item }">
        <span v-if="item.due_date" :class="{ 'text-error font-weight-medium': isOverdue(item) }">
          {{ item.due_date }}
        </span>
        <span v-else class="text-medium-emphasis">—</span>
      </template>

      <template #[`item.actions`]="{ item }">
        <v-btn
          icon="mdi-pencil"
          variant="text"
          size="small"
          :aria-label="`Edit ${item.title}`"
          :to="{ name: 'task-detail', params: { id: item.id } }"
        />
        <v-btn
          icon="mdi-delete"
          variant="text"
          size="small"
          color="error"
          :aria-label="`Delete ${item.title}`"
          @click="taskToDelete = item"
        />
      </template>
    </v-data-table-server>
  </v-card>

  <v-dialog v-model="createOpen" max-width="640">
    <v-card title="New task">
      <v-card-text>
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
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
