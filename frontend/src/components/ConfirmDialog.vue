<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    text: string
    confirmText?: string
    loading?: boolean
  }>(),
  { confirmText: 'Confirm', loading: false },
)

const open = defineModel<boolean>({ required: true })

defineEmits<{ confirm: [] }>()
</script>

<template>
  <v-dialog v-model="open" max-width="420" :persistent="loading">
    <v-card :title="title" :text="text">
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="loading" @click="open = false">Cancel</v-btn>
        <v-btn color="error" variant="flat" :loading="loading" @click="$emit('confirm')">
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
