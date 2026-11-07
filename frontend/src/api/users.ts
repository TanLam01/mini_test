import type { Resource, User } from '@/types/api'

import { http } from './http'

export async function listUsers(): Promise<User[]> {
  const { data } = await http.get<Resource<User[]>>('/api/users')

  return data.data
}
