import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useNotifyStore = defineStore('notify', () => {
  const visible = ref(false)
  const message = ref('')
  const color = ref<'success' | 'error' | 'info'>('success')

  function show(text: string, type: 'success' | 'error' | 'info' = 'success'): void {
    message.value = text
    color.value = type
    visible.value = true
  }

  return { visible, message, color, show }
})
