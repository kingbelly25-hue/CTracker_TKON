// 날짜는 로컬 기준 'YYYY-MM-DD' 문자열 하나로 다룬다.
// UTC로 저장하면 밤에 훈련했을 때 어제 기록으로 밀리는 일이 생긴다.

export const DAY_MS = 24 * 60 * 60 * 1000

export function dayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shiftDays(key, delta) {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + delta))
}

export function daysSince(key, from = new Date()) {
  const [y, m, d] = key.split('-').map(Number)
  const then = new Date(y, m - 1, d)
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((today - then) / DAY_MS)
}
