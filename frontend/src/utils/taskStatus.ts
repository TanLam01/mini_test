import type { TaskStatus } from '@/types/api'

export const TASK_STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: 'To do', color: 'grey' },
  in_progress: { label: 'In progress', color: 'blue' },
  done: { label: 'Done', color: 'green' },
}

export const TASK_STATUS_OPTIONS = (Object.keys(TASK_STATUS_META) as TaskStatus[]).map((value) => ({
  value,
  title: TASK_STATUS_META[value].label,
}))

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && value in TASK_STATUS_META
}
