// 간격 반복(SRS) + 준비도% 계산
//
// 송신(성공/보완 2단계)과 수신(완전/일부/놓침 3단계)이 같은 함수를 쓴다.
// 정확한 간격 수치는 코딩하며 수렴 대상 (화면명세 서문).

const DAY = 24 * 60 * 60 * 1000

// level별 다음 복습까지의 일수. level 0 = 미학습/실패 → 오늘 다시.
export const INTERVALS_DAYS = [0, 1, 3, 7, 14, 30]
export const MAX_LEVEL = INTERVALS_DAYS.length - 1

export function emptyRecord() {
  return { level: 0, attempts: 0, successes: 0, dueAt: null, lastAt: null }
}

export function getRecord(records, id) {
  return records[id] ?? emptyRecord()
}

// dueAt이 없으면 = 한 번도 안 건드린 항목 = 지금 복습 대상
export function isDue(record, now = Date.now()) {
  return record.dueAt == null || record.dueAt <= now
}

// grade: 'pass'(성공/완전 파악) | 'partial'(일부만 파악) | 'fail'(보완/놓침)
// partial은 level을 올리지도 0으로 떨구지도 않는다 — 부분 이해를 그대로 반영 (화면명세 3장)
export function grade(record, result, now = Date.now()) {
  const level =
    result === 'pass'
      ? Math.min(record.level + 1, MAX_LEVEL)
      : result === 'partial'
        ? record.level
        : 0

  return {
    level,
    attempts: record.attempts + 1,
    successes: record.successes + (result === 'pass' ? 1 : 0),
    lastAt: now,
    dueAt: now + INTERVALS_DAYS[level] * DAY,
  }
}

// 항목 1개의 숙달도 0~1. level이 곧 인출 성공의 누적이므로 level 기반으로 본다.
export function mastery(record) {
  return record.level / MAX_LEVEL
}

// 준비도% — "지금 이 미팅 들어가면 몇 % 준비?"를 단일 숫자로 (기획서 5장 ②)
// 블록과 질문을 항목 단위로 동등 가중해 평균낸다. 가중치 조정은 수렴 대상.
export function readiness(records, ids) {
  if (ids.length === 0) return 0
  const total = ids.reduce((sum, id) => sum + mastery(getRecord(records, id)), 0)
  return Math.round((total / ids.length) * 100)
}

export function dueIds(records, ids, now = Date.now()) {
  return ids.filter((id) => isDue(getRecord(records, id), now))
}
