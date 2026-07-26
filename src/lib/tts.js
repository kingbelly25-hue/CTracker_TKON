// 수신 훈련용 음원 (기획서 6장).
//
// 생성은 서버리스 함수 api/tts.js가 하고, 여기는 받은 raw PCM을 재생 가능하게 만든다.
// Gemini TTS는 컨테이너 없는 PCM(L16)을 base64로 준다 → WAV 헤더를 붙여야 <audio>가 읽는다.
//
// 캐시가 핵심이다: 화면명세 3장이 "다시 듣기 무제한"을 요구하는데
// 재생할 때마다 호출하면 유료 키로 돈이 나간다.
// 질문 1개당 세션 1회만 생성하고 그 뒤로는 메모리에서 재생한다.

import { postJson } from './api'

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

  const { data, mimeType } = await postJson('/api/tts', { text }, signal)
  const blob = pcmToWavBlob(base64ToBytes(data), sampleRateOf(mimeType))
  const url = URL.createObjectURL(blob)
  cache.set(id, url)
  return url
}

// 브라우저 내장 음성 — 서버 음원이 막히면 여기로 떨어진다.
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
