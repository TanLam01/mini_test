import { isAxiosError } from 'axios'

import type { ValidationErrors } from '@/types/api'

export function getStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

export function getValidationErrors(error: unknown): ValidationErrors | null {
  if (getStatus(error) !== 422 || !isAxiosError(error)) {
    return null
  }

  return (error.response?.data as { errors?: ValidationErrors } | undefined)?.errors ?? {}
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!isAxiosError(error)) {
    return fallback
  }

  if (!error.response) {
    return 'Cannot reach the server. Check your connection and that the API is running.'
  }

  const message = (error.response.data as { message?: unknown } | undefined)?.message

  return typeof message === 'string' && message !== '' ? message : fallback
}
