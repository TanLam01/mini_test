import { useQuery } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { listUsers } from '@/api/users'

export const userKeys = {
  all: ['users'] as const,
}

export function useUsersQuery(enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: listUsers,
    staleTime: 5 * 60_000,
    enabled: computed(() => toValue(enabled)),
  })
}
