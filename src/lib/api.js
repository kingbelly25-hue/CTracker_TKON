// 서버리스 함수(/api/*) 호출 창구.
//
// Gemini 키는 서버에만 있다. 브라우저는 키를 모르고, 알 필요도 없다.
// 대신 접근 코드(APP_PASSCODE)를 헤더로 보낸다 — 배포 주소를 아는 제3자가
// 남의 유료 키로 요청을 태우는 것을 막기 위한 것.

const PASS_KEY = 'emeet.pass'

export function getPasscode() {
  try {
    return localStorage.getItem(PASS_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setPasscode(value) {
  try {
    if (value) localStorage.setItem(PASS_KEY, value)
    else localStorage.removeItem(PASS_KEY)
  } catch {
    // 저장 실패해도 이번 세션 호출엔 영향 없음
  }
}

export async function postJson(path, body, signal) {
  const passcode = getPasscode()
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(passcode ? { 'x-app-pass': passcode } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `서버 오류 ${response.status}`)
  }
  return data
}
