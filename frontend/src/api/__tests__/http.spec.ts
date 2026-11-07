import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { http, setUnauthorizedHandler } from '../http'

type Reply = { status: number; data?: unknown }

let calls: string[] = []
let replies: Reply[] = []
const originalAdapter = http.defaults.adapter

beforeEach(() => {
  calls = []
  replies = []
  http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    calls.push(`${config.method?.toUpperCase()} ${config.url}`)
    const reply = replies.shift() ?? { status: 200 }
    const response = {
      data: reply.data ?? {},
      status: reply.status,
      statusText: '',
      headers: {},
      config,
    } as AxiosResponse

    if (reply.status >= 400) {
      throw new AxiosError('Request failed', String(reply.status), config, {}, response)
    }

    return response
  }
})

afterEach(() => {
  http.defaults.adapter = originalAdapter
  setUnauthorizedHandler(() => {})
})

describe('http client', () => {
  it('sends credentials and asks for JSON', () => {
    expect(http.defaults.withCredentials).toBe(true)
    expect(http.defaults.withXSRFToken).toBe(true)
    expect(http.defaults.headers.Accept).toBe('application/json')
  })

  it('refreshes the CSRF cookie and retries once on 419', async () => {
    replies = [{ status: 419 }, { status: 204 }, { status: 201, data: { data: { id: 1 } } }]

    const response = await http.post('/api/tasks', { title: 'x' })

    expect(response.status).toBe(201)
    expect(calls).toEqual(['POST /api/tasks', 'GET /sanctum/csrf-cookie', 'POST /api/tasks'])
  })

  it('does not retry more than once when CSRF keeps failing', async () => {
    replies = [{ status: 419 }, { status: 204 }, { status: 419 }]

    await expect(http.post('/api/tasks')).rejects.toMatchObject({ response: { status: 419 } })
    expect(calls).toHaveLength(3)
  })

  it('notifies the app when the session is gone (401)', async () => {
    const handler = vi.fn<() => void>()
    setUnauthorizedHandler(handler)
    replies = [{ status: 401 }]

    await expect(http.get('/api/tasks')).rejects.toBeInstanceOf(AxiosError)
    expect(handler).toHaveBeenCalledOnce()
  })
})
