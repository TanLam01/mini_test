import type { Paginated, Resource, Task, TaskFilters, TaskPayload } from '@/types/api'

import { http } from './http'

export async function listTasks(
  filters: TaskFilters,
  signal?: AbortSignal,
): Promise<Paginated<Task>> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== null && value !== undefined && value !== '',
    ),
  )
  const { data } = await http.get<Paginated<Task>>('/api/tasks', { params, signal })

  return data
}

export async function getTask(id: number): Promise<Task> {
  const { data } = await http.get<Resource<Task>>(`/api/tasks/${id}`)

  return data.data
}

export async function createTask(payload: TaskPayload): Promise<Task> {
  const { data } = await http.post<Resource<Task>>('/api/tasks', payload)

  return data.data
}

export async function updateTask(id: number, payload: TaskPayload): Promise<Task> {
  const { data } = await http.put<Resource<Task>>(`/api/tasks/${id}`, payload)

  return data.data
}

export async function deleteTask(id: number): Promise<void> {
  await http.delete(`/api/tasks/${id}`)
}
