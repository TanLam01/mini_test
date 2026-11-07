import { computed } from 'vue'

import { useUsersQuery } from '@/queries/users'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types/api'

export function useAssignees() {
  const auth = useAuthStore()
  const usersQuery = useUsersQuery(() => auth.isAdmin)

  const users = computed<User[]>(() => {
    if (auth.isAdmin) {
      return usersQuery.data.value ?? []
    }

    return auth.user ? [auth.user] : []
  })

  return { users, loading: usersQuery.isLoading }
}
