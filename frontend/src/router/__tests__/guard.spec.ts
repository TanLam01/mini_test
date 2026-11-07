import { describe, expect, it } from 'vitest'

import { resolveAuthRedirect, safeRedirectTarget } from '../guard'

const route = (meta: Record<string, boolean>, fullPath = '/tasks/5', query = {}) => ({
  meta,
  fullPath,
  query,
})

describe('resolveAuthRedirect', () => {
  it('sends guests from protected routes to login, remembering where they were going', () => {
    expect(resolveAuthRedirect(route({ requiresAuth: true }), false)).toEqual({
      name: 'login',
      query: { redirect: '/tasks/5' },
    })
  })

  it('lets authenticated users through protected routes', () => {
    expect(resolveAuthRedirect(route({ requiresAuth: true }), true)).toBeNull()
  })

  it('sends logged-in users away from the login page to the requested path', () => {
    expect(
      resolveAuthRedirect(route({ guestOnly: true }, '/login', { redirect: '/tasks/7' }), true),
    ).toBe('/tasks/7')
    expect(resolveAuthRedirect(route({ guestOnly: true }, '/login'), true)).toBe('/tasks')
  })

  it('lets guests open the login page', () => {
    expect(resolveAuthRedirect(route({ guestOnly: true }, '/login'), false)).toBeNull()
  })
})

describe('safeRedirectTarget', () => {
  it('only allows internal paths (no open redirect)', () => {
    expect(safeRedirectTarget('/tasks?status=done')).toBe('/tasks?status=done')
    expect(safeRedirectTarget('//evil.example.com')).toBe('/tasks')
    expect(safeRedirectTarget('https://evil.example.com')).toBe('/tasks')
    expect(safeRedirectTarget(undefined)).toBe('/tasks')
    expect(safeRedirectTarget(['/a', '/b'])).toBe('/tasks')
  })
})
