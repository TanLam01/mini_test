export type UserRole = 'admin' | 'user'

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
}

export interface Task {
  id: number
  title: string
  description: string | null
  status: TaskStatus
  assigned_to: number
  assignee?: User
  due_date: string | null
  created_at: string | null
  updated_at: string | null
}

export interface TaskPayload {
  title: string
  description: string | null
  status: TaskStatus
  assigned_to: number
  due_date: string | null
}

export interface TaskFilters {
  status?: TaskStatus | null
  assigned_to?: number | null
  search?: string | null
  page?: number
  per_page?: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface Resource<T> {
  data: T
}

export interface Paginated<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export type ValidationErrors = Partial<Record<string, string[]>>
