import type { LoginCredentials, Resource, User } from '@/types/api'

import { fetchCsrfCookie, http } from './http'

export async function login(credentials: LoginCredentials): Promise<User> {
  await fetchCsrfCookie()
  const { data } = await http.post<Resource<User>>('/api/login', credentials)

  return data.data
}

export async function logout(): Promise<void> {
  await http.post('/api/logout')
}

export async function me(): Promise<User> {
  const { data } = await http.get<Resource<User>>('/api/me')

  return data.data
}
