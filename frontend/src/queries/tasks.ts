import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { createTask, deleteTask, getTask, listTasks, updateTask } from '@/api/tasks'
import type { Paginated, Task, TaskFilters, TaskPayload, TaskStatus } from '@/types/api'

export type TaskStats = Record<TaskStatus | 'all', number>

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
  statsRoot: () => [...taskKeys.all, 'stats'] as const,
  stats: (assignedTo: number | null) => [...taskKeys.statsRoot(), assignedTo] as const,
  detail: (id: number) => [...taskKeys.all, 'detail', id] as const,
}

export function useTasksQuery(filters: MaybeRefOrGetter<TaskFilters>) {
  return useQuery({
    queryKey: computed(() => taskKeys.list(toValue(filters))),
    queryFn: ({ queryKey, signal }) => listTasks(queryKey[2], signal),
    placeholderData: keepPreviousData,
  })
}

export function useTaskStatsQuery(assignedTo: MaybeRefOrGetter<number | null>) {
  return useQuery({
    queryKey: computed(() => taskKeys.stats(toValue(assignedTo))),
    queryFn: async ({ queryKey, signal }): Promise<TaskStats> => {
      const count = (status?: TaskStatus) =>
        listTasks({ status, assigned_to: queryKey[2], per_page: 1 }, signal).then(
          (page) => page.meta.total,
        )
      const [all, todo, inProgress, done] = await Promise.all([
        count(),
        count('todo'),
        count('in_progress'),
        count('done'),
      ])

      return { all, todo, in_progress: inProgress, done }
    },
    placeholderData: keepPreviousData,
  })
}

export function useTaskQuery(id: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => taskKeys.detail(toValue(id))),
    queryFn: ({ queryKey }) => getTask(queryKey[2]),
    enabled: computed(() => toValue(id) > 0),
  })
}

function useInvalidateTaskCollections() {
  const queryClient = useQueryClient()

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: taskKeys.statsRoot() }),
    ])
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateTaskCollections()

  return useMutation({
    mutationFn: (payload: TaskPayload) => createTask(payload),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task)
      void invalidate()
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateTaskCollections()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaskPayload }) => updateTask(id, payload),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task)
      void invalidate()
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateTaskCollections()

  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) })
      queryClient.setQueriesData<Paginated<Task>>({ queryKey: taskKeys.lists() }, (page) =>
        page
          ? {
              ...page,
              data: page.data.filter((task) => task.id !== id),
              meta: { ...page.meta, total: Math.max(0, page.meta.total - 1) },
            }
          : page,
      )
      void invalidate()
    },
  })
}
