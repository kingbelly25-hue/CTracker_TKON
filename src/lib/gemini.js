// 판정 호출 (기획서 6장).
//
// 실제 Gemini 호출은 서버리스 함수 api/judge.js가 한다. 여기는 얇은 창구다.
// 프롬프트도 서버가 조립한다 — 이 엔드포인트가 범용 LLM으로 쓰이면 곧 요금이다.
//
// 여기로 나가는 건 "범용 연습용" 콘텐츠만이다 (mode: 'practice').
// 실전 대본(mode: 'live')은 이 파일을 타면 안 된다 — 분류 책임은 사용자에게 있고,
// 앱은 칸만 나눠줄 뿐 기밀을 자동 감지하지 못한다.

import { postJson } from './api'

// 판정이 느릴 때 세션이 막히지 않게 상한을 둔다. 실측 4~6초 (화면명세 2장)
export const JUDGE_TIMEOUT_MS = 20000

export function judgeSend({ trigger, answer, userInput }, signal) {
  return postJson('/api/judge', { kind: 'send', payload: { trigger, answer, userInput } }, signal)
}

export function judgeReceive({ text, gist, userInput }, signal) {
  return postJson('/api/judge', { kind: 'receive', payload: { text, gist, userInput } }, signal)
}
