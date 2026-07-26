// 기기 간 동기화 — 연결 코드 + Firestore (기획서 7장, CutTracker 방식 이식).
//
// 계정·로그인이 없다. 한쪽 기기에서 코드를 만들고 다른 기기에 그 코드를 적으면
// 같은 문서를 함께 쓴다. 코드가 곧 열쇠다.
//
// 녹음은 동기화하지 않는다 (기획서 7장) — 1MiB 문서 한도를 넘기고,
// 사진과 같은 처리로 로컬에만 둔다. Before/After 대조는 같은 기기에서만 된다.

import { isConfigured, loadFirestore } from './firebase'

const CODE_KEY = 'emeet.code'
const COLLECTION = 'sync'

// 헷갈리는 글자(0/O, 1/I/L)를 뺀 알파벳 — 손으로 옮겨 적는 코드라서
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export { isConfigured }

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function getCode() {
  try {
    return localStorage.getItem(CODE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setCode(code) {
  try {
    if (code) localStorage.setItem(CODE_KEY, code)
    else localStorage.removeItem(CODE_KEY)
  } catch {
    // 저장 실패해도 이번 세션 동기화엔 영향 없음
  }
}

export function normalizeCode(input) {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH)
}

export function isValidCode(code) {
  return code.length === CODE_LENGTH
}

// 동기화 대상만 골라 담는다. recordings는 의도적으로 제외.
function syncable(state) {
  return {
    records: state.records ?? {},
    history: state.history ?? {},
    flags: state.flags ?? [],
  }
}

// 양쪽을 합친다. 어느 쪽도 버리지 않는 게 원칙 —
// 한 기기에서 훈련하고 다른 기기에서 열었다가 진도가 날아가면 안 된다.
export function mergeState(local, remote) {
  if (!remote) return local

  // 레코드: 항목별로 마지막 학습이 더 최근인 쪽이 이긴다
  const records = { ...local.records }
  for (const [id, incoming] of Object.entries(remote.records ?? {})) {
    const mine = records[id]
    if (!mine || (incoming.lastAt ?? 0) > (mine.lastAt ?? 0)) records[id] = incoming
  }

  // 일별 기록: 같은 날짜면 시도 횟수가 많은 쪽이 더 온전한 기록이다
  const history = { ...local.history }
  for (const [day, incoming] of Object.entries(remote.history ?? {})) {
    const mine = history[day]
    if (!mine || (incoming.attempts ?? 0) > (mine.attempts ?? 0)) history[day] = incoming
  }

  // 판정 신고: 합치고 중복만 제거
  const seen = new Set()
  const flags = [...(local.flags ?? []), ...(remote.flags ?? [])].filter((flag) => {
    const key = `${flag.blockId}|${flag.at}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { ...local, records, history, flags }
}

export async function pull(code) {
  const { db, firestore } = await loadFirestore()
  const snapshot = await firestore.getDoc(firestore.doc(db, COLLECTION, code))
  return snapshot.exists() ? snapshot.data() : null
}

export async function push(code, state) {
  const { db, firestore } = await loadFirestore()
  await firestore.setDoc(firestore.doc(db, COLLECTION, code), {
    ...syncable(state),
    updatedAt: Date.now(),
  })
}
