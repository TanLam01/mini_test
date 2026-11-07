<script setup lang="ts">
import { computed } from 'vue'

import type { TaskStatus } from '@/types/api'
import { TASK_STATUS_META } from '@/utils/taskStatus'

const props = defineProps<{ status: TaskStatus }>()

const meta = computed(() => TASK_STATUS_META[props.status])
</script>

<template>
  <v-chip :color="meta.color" size="small" variant="flat" label>{{ meta.label }}</v-chip>
</template>
