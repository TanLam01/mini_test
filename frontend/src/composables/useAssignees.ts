import { onMounted, ref } from 'vue'

import { getErrorMessage } from '@/api/errors'
import { listUsers } from '@/api/users'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types/api'

export function useAssignees() {
  const auth = useAuthStore()
  const users = ref<User[]>(!auth.isAdmin && auth.user ? [auth.user] : [])
  const loading = ref(false)
  const error = ref('')

  onMounted(async () => {
    if (!auth.isAdmin) {
      return
    }

    loading.value = true
    try {
      users.value = await listUsers()
    } catch (e) {
      error.value = getErrorMessage(e, 'Could not load users.')
    } finally {
      loading.value = false
    }
  })

  return { users, loading, error }
}
