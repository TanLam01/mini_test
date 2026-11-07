import { flushPromises, mount } from '@vue/test-utils'
import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createVuetify } from 'vuetify'

import * as tasksApi from '@/api/tasks'
import type { Task, TaskPayload, User } from '@/types/api'

import TaskForm from '../TaskForm.vue'

vi.mock('@/api/tasks', () => ({
  createTask: vi.fn<(payload: TaskPayload) => Promise<Task>>(),
  updateTask: vi.fn<(id: number, payload: TaskPayload) => Promise<Task>>(),
}))

const users: User[] = [
  { id: 1, name: 'Admin', email: 'admin@example.com', role: 'admin' },
  { id: 2, name: 'User One', email: 'user1@example.com', role: 'user' },
]

const existing: Task = {
  id: 7,
  title: 'Write docs',
  description: null,
  status: 'in_progress',
  assigned_to: 2,
  due_date: '2026-12-01',
  created_at: null,
  updated_at: null,
}

function mountForm(props: Record<string, unknown> = {}) {
  return mount(TaskForm, {
    props: { users, defaultAssigneeId: 1, ...props },
    global: { plugins: [createVuetify()] },
  })
}

function validationError(errors: Record<string, string[]>): AxiosError {
  const response = { status: 422, data: { message: 'Invalid', errors } } as AxiosResponse
  return new AxiosError('Unprocessable', '422', undefined, {}, response)
}

beforeEach(() => {
  vi.mocked(tasksApi.createTask).mockReset()
  vi.mocked(tasksApi.updateTask).mockReset()
})

describe('TaskForm', () => {
  it('creates a task with POST payload built from the fields', async () => {
    vi.mocked(tasksApi.createTask).mockResolvedValue({ ...existing, id: 9, title: 'New task' })
    const wrapper = mountForm()

    await wrapper.find('[data-test="title"] input').setValue('New task')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(tasksApi.createTask).toHaveBeenCalledWith({
      title: 'New task',
      description: null,
      status: 'todo',
      assigned_to: 1,
      due_date: null,
    })
    expect(wrapper.emitted('saved')?.[0]).toEqual([{ ...existing, id: 9, title: 'New task' }])
  })

  it('does not call the API when the title is empty', async () => {
    const wrapper = mountForm()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(tasksApi.createTask).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('This field is required.')
  })

  it('pre-fills the fields and uses PUT in edit mode', async () => {
    vi.mocked(tasksApi.updateTask).mockResolvedValue(existing)
    const wrapper = mountForm({ task: existing })

    expect((wrapper.find('[data-test="title"] input').element as HTMLInputElement).value).toBe(
      'Write docs',
    )
    expect(wrapper.text()).toContain('Save changes')

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(tasksApi.updateTask).toHaveBeenCalledWith(7, {
      title: 'Write docs',
      description: null,
      status: 'in_progress',
      assigned_to: 2,
      due_date: '2026-12-01',
    })
  })

  it('shows server validation errors next to the field', async () => {
    vi.mocked(tasksApi.createTask).mockRejectedValue(
      validationError({ assigned_to: ['You can only assign tasks to yourself.'] }),
    )
    const wrapper = mountForm()

    await wrapper.find('[data-test="title"] input').setValue('Sneaky')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-test="assignee"]').text()).toContain(
      'You can only assign tasks to yourself.',
    )
    expect(wrapper.find('[data-test="form-error"]').exists()).toBe(true)
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
})
