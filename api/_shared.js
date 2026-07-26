// Vercel 서버리스 함수 공용 유틸.
//
// 핸들러는 Node의 req/res만 쓴다 — 그래야 Vercel과 로컬 Vite 개발서버에서
// 같은 파일이 그대로 돈다 (vite.config.js의 개발용 미들웨어 참고).

export const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

// 이 엔드포인트는 유료 키로 돈을 쓴다. 주소만 알면 아무나 호출할 수 있으므로
// APP_PASSCODE가 설정돼 있으면 헤더로 확인한다. 강한 인증이 아니라 무단 사용 차단용.
export function unauthorized(req) {
  const expected = process.env.APP_PASSCODE
  if (!expected) return false
  return req.headers['x-app-pass'] !== expected
}

export function guard(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'POST만 허용됩니다' })
    return false
  }
  if (unauthorized(req)) {
    json(res, 401, { error: '접근 코드가 맞지 않습니다' })
    return false
  }
  if (!process.env.GEMINI_API_KEY) {
    json(res, 500, { error: '서버에 GEMINI_API_KEY가 설정되지 않았습니다' })
    return false
  }
  return true
}

export async function callGemini(model, body) {
  const response = await fetch(
    `${ENDPOINT}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    // 키가 에러 본문에 섞여 나오는 일은 없지만, 그대로 흘리지 않고 잘라서 넘긴다
    const error = new Error(detail.slice(0, 300))
    error.status = response.status
    throw error
  }

  return response.json()
}
