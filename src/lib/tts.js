// 수신 훈련용 음원 생성 (기획서 6장 — 무료 티어 TTS)
//
// Gemini TTS는 컨테이너 없는 raw PCM(L16)을 base64로 준다.
// 브라우저 <audio>는 그걸 못 읽으므로 WAV 헤더를 앞에 붙여서 재생 가능한 Blob으로 만든다.
//
// 캐시가 핵심이다: 화면명세 3장이 "다시 듣기 무제한"을 요구하는데
// 재생할 때마다 호출하면 분당 10요청 한도를 바로 넘긴다.
// 질문 1개당 세션 1회만 생성하고 그 뒤로는 메모리에서 재생한다.

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const TTS_MODEL = import.meta.env.VITE_GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'
const VOICE = import.meta.env.VITE_GEMINI_TTS_VOICE || 'Kore'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export const hasTts = Boolean(API_KEY)

// 세션 캐시. 새로고침하면 비워진다 —
// localStorage에 넣으면 녹음(Before/After, 기획서 5장 ①)이 쓸 용량을 잡아먹는다.
const cache = new Map()

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
}

// raw PCM(16bit LE mono) → WAV
function pcmToWavBlob(pcm, sampleRate) {
  const channels = 1
  const bitsPerSample = 16
  const blockAlign = (channels * bitsPerSample) / 8
  const buffer = new ArrayBuffer(44 + pcm.length)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcm.length, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt 청크 길이
  view.setUint16(20, 1, true) // 1 = PCM
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, pcm.length, true)
  new Uint8Array(buffer, 44).set(pcm)

  return new Blob([buffer], { type: 'audio/wav' })
}

// mimeType 예: "audio/L16;codec=pcm;rate=24000"
function sampleRateOf(mimeType) {
  const match = /rate=(\d+)/.exec(mimeType || '')
  return match ? Number(match[1]) : 24000
}

export async function getAudioUrl(id, text, signal) {
  if (cache.has(id)) return cache.get(id)

  // 스타일 지시는 "지시: 본문" 형태로 준다 — 그래야 지시문을 읽지 않는다.
  const prompt = `Read the following line as a senior executive asking a question in a business partnership meeting. Natural pace, neutral American accent: ${text}`

  const response = await fetch(`${ENDPOINT}/${TTS_MODEL}:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`TTS ${response.status}: ${detail.slice(0, 200)}`)
  }

  const data = await response.json()
  const inline = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
    ?.inlineData
  if (!inline?.data) throw new Error('TTS 응답에 음원이 없음')

  const blob = pcmToWavBlob(base64ToBytes(inline.data), sampleRateOf(inline.mimeType))
  const url = URL.createObjectURL(blob)
  cache.set(id, url)
  return url
}

// 브라우저 내장 음성 — Gemini TTS가 막히면 여기로 떨어진다.
// 음질·억양이 실전과 거리가 있지만 세션이 멈추는 것보단 낫다.
export const canSpeakLocally = typeof window !== 'undefined' && 'speechSynthesis' in window

export function speakLocally(text) {
  if (!canSpeakLocally) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.95
  window.speechSynthesis.speak(utterance)
}

export function stopLocalSpeech() {
  if (canSpeakLocally) window.speechSynthesis.cancel()
}
