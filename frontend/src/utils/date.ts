export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null

  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

const dateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const dateTimeFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDate(value: string | null | undefined): string {
  const date = parseIsoDate(value)

  return date ? dateFormatter.format(date) : ''
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFormatter.format(new Date(value)) : ''
}

export type DueState = 'overdue' | 'today' | null

export function dueState(
  dueDate: string | null,
  done: boolean,
  today = toIsoDate(new Date()),
): DueState {
  if (!dueDate || done) {
    return null
  }

  if (dueDate < today) {
    return 'overdue'
  }

  return dueDate === today ? 'today' : null
}
