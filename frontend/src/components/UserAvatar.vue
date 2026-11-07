<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 32 })

const PALETTE = ['indigo', 'teal', 'orange', 'pink', 'cyan', 'deep-purple', 'light-green', 'amber']

const initials = computed(() =>
  props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(''),
)

const color = computed(() => {
  const hash = [...props.name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return PALETTE[hash % PALETTE.length]
})
</script>

<template>
  <v-avatar :size="size" :color="color" variant="tonal" class="font-semibold">
    <span :style="{ fontSize: `${Math.round(size * 0.4)}px` }">{{ initials }}</span>
  </v-avatar>
</template>
