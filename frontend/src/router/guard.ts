import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
  }
}

export function resolveAuthRedirect(
  to: Pick<RouteLocationNormalized, 'meta' | 'fullPath' | 'query'>,
  isAuthenticated: boolean,
): RouteLocationRaw | null {
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return safeRedirectTarget(to.query.redirect)
  }

  return null
}

/** Chỉ chấp nhận path nội bộ để ?redirect= không bị lợi dụng thành open redirect (VD: //evil.com). */
export function safeRedirectTarget(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/tasks'
}
