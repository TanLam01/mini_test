import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})

export function fetchCsrfCookie(): Promise<unknown> {
  return http.get('/sanctum/csrf-cookie')
}

let onUnauthorized: () => void = () => {}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean }

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const config = error.config as RetriableConfig | undefined

    if (status === 419 && config && !config._csrfRetried) {
      config._csrfRetried = true
      await fetchCsrfCookie()

      return http.request(config)
    }

    if (status === 401) {
      onUnauthorized()
    }

    return Promise.reject(error)
  },
)
