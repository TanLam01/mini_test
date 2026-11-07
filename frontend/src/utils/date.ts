/**
 * Dùng thành phần ngày theo giờ địa phương thay vì toISOString(): toISOString đổi sang UTC
 * nên ngày được chọn bị lùi 1 ngày ở múi giờ dương (VD: UTC+7, 00:00 ngày 01/12 thành 30/11).
 */
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
