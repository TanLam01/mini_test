import '@mdi/font/css/materialdesignicons.css'

import { createVuetify } from 'vuetify'

const field = {
  variant: 'outlined',
  density: 'comfortable',
  rounded: 'lg',
  color: 'primary',
} as const

export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#4F46E5',
          secondary: '#64748B',
          background: '#F8FAFC',
          surface: '#FFFFFF',
          'on-background': '#0F172A',
          'on-surface': '#0F172A',
          error: '#DC2626',
          success: '#16A34A',
          info: '#2563EB',
          warning: '#D97706',
        },
        variables: {
          'border-color': '#0F172A',
          'border-opacity': 0.1,
          'medium-emphasis-opacity': 0.62,
        },
      },
    },
  },
  defaults: {
    VTextField: field,
    VTextarea: field,
    VSelect: field,
    VBtn: { rounded: 'lg', elevation: 0 },
    VCard: { rounded: 'lg', elevation: 0, border: true },
    VChip: { rounded: 'lg' },
    VDialog: { scrollable: true },
    VTooltip: { location: 'top' },
    VAlert: { rounded: 'lg' },
  },
})
