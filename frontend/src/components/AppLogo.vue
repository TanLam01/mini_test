<script setup lang="ts">
withDefaults(defineProps<{ inverted?: boolean }>(), { inverted: false })
</script>

<template>
  <div class="flex items-center gap-3">
    <div
      class="grid size-9 place-items-center rounded-xl"
      :class="inverted ? 'bg-white/15 text-white' : 'bg-indigo-600 text-white shadow-sm'"
    >
      <v-icon icon="mdi-checkbox-marked-circle-outline" size="20" />
    </div>
    <div class="leading-tight">
      <div class="text-[15px] font-semibold" :class="inverted ? 'text-white' : 'text-slate-900'">
        Team Tasks
      </div>
      <div class="text-xs" :class="inverted ? 'text-indigo-100' : 'text-slate-500'">Manager</div>
    </div>
  </div>
</template>
