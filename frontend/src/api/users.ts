import type { Resource, User } from '@/types/api'

import { http } from './http'

/** Chỉ admin gọi được (403 với user thường). */
export async function listUsers(): Promise<User[]> {
  const { data } = await http.get<Resource<User[]>>('/api/users')

  return data.data
}
