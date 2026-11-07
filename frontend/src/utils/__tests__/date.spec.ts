import { describe, expect, it } from 'vitest'

import { dueState, formatDate, parseIsoDate, toIsoDate } from '../date'

describe('date utils', () => {
  it('formats using local calendar date, not UTC', () => {
    expect(toIsoDate(new Date(2026, 11, 1, 0, 0))).toBe('2026-12-01')
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('parses YYYY-MM-DD into a local date and round-trips', () => {
    const parsed = parseIsoDate('2026-12-01')

    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(11)
    expect(parsed?.getDate()).toBe(1)
    expect(toIsoDate(parsed as Date)).toBe('2026-12-01')
  })

  it('returns null for empty or malformed input', () => {
    expect(parseIsoDate(null)).toBeNull()
    expect(parseIsoDate('')).toBeNull()
    expect(parseIsoDate('01/12/2026')).toBeNull()
  })
})

describe('dueState', () => {
  const today = '2026-11-07'

  it('flags past due dates of unfinished tasks as overdue', () => {
    expect(dueState('2026-11-06', false, today)).toBe('overdue')
  })

  it('flags tasks due today', () => {
    expect(dueState('2026-11-07', false, today)).toBe('today')
  })

  it('ignores future dates, missing dates and finished tasks', () => {
    expect(dueState('2026-11-08', false, today)).toBeNull()
    expect(dueState(null, false, today)).toBeNull()
    expect(dueState('2026-11-01', true, today)).toBeNull()
  })
})

describe('formatDate', () => {
  it('renders a readable date and an empty string for no date', () => {
    expect(formatDate('2026-12-01')).toBe('Dec 1, 2026')
    expect(formatDate(null)).toBe('')
  })
})
