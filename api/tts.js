import { callGemini, guard, json, readBody } from './_shared.js'

// 음원 생성 프록시.
// TTS는 판정보다 비싸므로 입력 길이를 더 짧게 자른다.

const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'
const VOICE = process.env.GEMINI_TTS_VOICE || 'Kore'
const MAX_LEN = 300

export default async function handler(req, res) {
  if (!guard(req, res)) return

  try {
    const { text } = await readBody(req)
    if (!text || typeof text !== 'string') {
      return json(res, 400, { error: 'text가 필요합니다' })
    }

    // 스타일 지시는 "지시: 본문" 형태로 준다 — 그래야 지시문 자체를 읽지 않는다
    const prompt = `Read the following line as a senior executive asking a question in a business partnership meeting. Natural pace, neutral American accent: ${text.slice(0, MAX_LEN)}`

    const data = await callGemini(MODEL, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      },
    })

    const inline = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData
    if (!inline?.data) return json(res, 502, { error: '음원 응답이 비어 있습니다' })

    // raw PCM 그대로 넘긴다. WAV 헤더 부착은 브라우저에서 (lib/tts.js)
    return json(res, 200, { data: inline.data, mimeType: inline.mimeType })
  } catch (e) {
    return json(res, e.status ?? 500, { error: e.message })
  }
}
