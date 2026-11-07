import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  // Gửi cookie session httpOnly + tự đọc cookie XSRF-TOKEN gắn vào header X-XSRF-TOKEN (Sanctum SPA auth).
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})

export function fetchCsrfCookie(): Promise<unknown> {
  return http.get('/sanctum/csrf-cookie')
}

let onUnauthorized: () => void = () => {}

/** Đăng ký từ main.ts để tránh import vòng http → store/router. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean }

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const config = error.config as RetriableConfig | undefined

    // 419 = CSRF token hết hạn (cùng vòng đời với session); lấy token mới và thử lại đúng 1 lần.
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
