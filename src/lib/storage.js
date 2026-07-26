// 로컬 저장 계층 (기획서 7장 — C방식: localStorage로 시작, 커지면 IndexedDB)
//
// 저장 계층만 교체하면 앱 본체는 안 건드리게 이 파일로 입출구를 모은다.
// 녹음(base64)은 Firestore로 동기화하지 않는다 — 같은 기기에서만 재생됨.

const KEY = 'emeet.v1'

const emptyState = () => ({
  records: {}, // { [blockId | questionId]: SRS 레코드 }
  recordings: {}, // { [meetingId]: { before, after } — 미팅당 최대 2개 }
  flags: [], // "이 판정이 이상한가요?" 기록. 프롬프트·콘텐츠 보정에 쓸 원재료
  history: {}, // { 'YYYY-MM-DD': { attempts, successes, readiness } } — 성과 화면의 재료
})

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    return { ...emptyState(), ...JSON.parse(raw) }
  } catch {
    // 캐시 청소·파싱 실패 시 빈 상태로 시작 (성과 증거 소실 위험은 기획서 7장에 인지됨)
    return emptyState()
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    return false // 용량 초과 → IndexedDB 이전 신호
  }
}
