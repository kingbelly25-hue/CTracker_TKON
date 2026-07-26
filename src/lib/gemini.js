// Gemini 무료 티어 호출 (기획서 6장)
//
// 여기로 나가는 건 "범용 연습용" 콘텐츠만이다 (mode: 'practice').
// 실전 대본(mode: 'live')은 이 파일을 타면 안 된다 — 분류 책임은 사용자에게 있고,
// 앱은 칸만 나눠줄 뿐 기밀을 자동 감지하지 못한다.

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-flash-latest'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export const hasApiKey = Boolean(API_KEY)

// 무료 티어는 느리거나 막힐 수 있다 (분당 10요청) → 대기 상한을 둔다.
// 정확한 초수는 수렴 대상 (화면명세 2장)
export const JUDGE_TIMEOUT_MS = 20000

async function callGemini(prompt, responseSchema, signal) {
  const response = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini 응답이 비어 있음')
  return JSON.parse(text)
}

const SEND_SCHEMA = {
  type: 'OBJECT',
  properties: {
    result: { type: 'STRING', enum: ['pass', 'fail'] },
    comment: { type: 'STRING' },
    correction: { type: 'STRING' },
  },
  required: ['result', 'comment', 'correction'],
}

// 송신 판정 — 한글 트리거를 보고 쓴 영어가 통하는지 본다.
//
// 판정 기준의 핵심: 의미가 통하면 격식 수준과 무관하게 성공이다 (화면명세 2장).
// 격식 차이를 실패로 잡으면 인출 훈련이 아니라 문체 교정이 되고, 성과가 다시 모호해진다.
export async function judgeSend({ trigger, answer, userInput }, signal) {
  const prompt = `당신은 비즈니스 영어 미팅 훈련 앱의 판정자다.
사용자는 한국어 트리거를 보고 영어 문장을 기억해서 입력했다. 통암기 인출 훈련이다.

[한국어 트리거]
${trigger}

[참고 정답 예시]
${answer}

[사용자 입력]
${userInput}

판정 규칙:
1. 의미가 통하면 pass다. 참고 정답과 단어가 달라도 상관없다.
2. 격식 수준(formal/casual)이 달라도 pass다. 격식 차이는 comment에만 짧게 적는다.
3. 문법이 조금 어색해도 원어민이 뜻을 알아듣고 미팅이 굴러가면 pass다.
4. 의미가 다르거나, 핵심 내용이 빠졌거나, 알아들을 수 없으면 fail이다.
5. 참고 정답의 [대괄호] 자리표시자는 사용자가 임의 값으로 채워도 되고 그대로 둬도 된다.

출력:
- result: pass 또는 fail
- comment: 한국어 한두 문장. 왜 그렇게 봤는지. 격식·뉘앙스 차이가 있으면 여기에.
- correction: 사용자 입력을 최소한으로 다듬은 자연스러운 영어 문장. 고칠 게 없으면 입력 그대로.`

  return callGemini(prompt, SEND_SCHEMA, signal)
}

const RECEIVE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    result: { type: 'STRING', enum: ['pass', 'partial', 'fail'] },
    comment: { type: 'STRING' },
    missed: { type: 'STRING' },
  },
  required: ['result', 'comment', 'missed'],
}

// 수신 판정 — 들은 질문의 요지를 잡았는지 3단계로 본다 (화면명세 3장).
// 청취 이해는 이분법이 아니라서 partial이 있어야 복습 스케줄이 맞는다.
export async function judgeReceive({ text, gist, userInput }, signal) {
  const prompt = `당신은 비즈니스 영어 미팅 훈련 앱의 청취 판정자다.
사용자는 영어 질문을 듣고, 요지를 한국어(또는 영어)로 한 줄 적었다. 받아쓰기가 아니라 요지 파악이다.

[들려준 원문]
${text}

[원문의 요지]
${gist}

[사용자가 적은 요지]
${userInput}

판정 규칙:
1. pass — 질문의 핵심을 잡았다. 표현이 달라도, 세부 단어를 놓쳐도 요지가 맞으면 pass다.
2. partial — 주제는 잡았지만 핵심 조건이나 방향을 놓쳤다.
3. fail — 무슨 질문인지 못 잡았거나 다른 뜻으로 알아들었다.

출력:
- comment: 한국어 한두 문장 판정 이유.
- missed: 놓친 부분을 구체적으로. 원문의 어느 표현을 못 들은 것 같은지 짚어라. 놓친 게 없으면 빈 문자열.`

  return callGemini(prompt, RECEIVE_SCHEMA, signal)
}
