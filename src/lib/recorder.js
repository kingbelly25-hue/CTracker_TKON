// Before/After 자기 녹음 (기획서 5장 ① — 이 앱의 핵심 급소 장치)
//
// 녹음은 로컬 전용이다. Firestore로 동기화하지 않는다 (기획서 7장).
// 즉 대조 재생은 녹음한 그 기기에서만 된다.

export const canRecord =
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof window !== 'undefined' &&
  'MediaRecorder' in window

// 너무 길면 localStorage 5MB를 혼자 다 먹는다 (기획서 7장 — 용량 차면 IndexedDB)
export const MAX_SECONDS = 60

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('녹음 파일을 읽지 못했습니다'))
    reader.readAsDataURL(blob)
  })
}

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const chunks = []
  const recorder = new MediaRecorder(stream)

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.start()

  const releaseMic = () => stream.getTracks().forEach((track) => track.stop())

  return {
    // base64 data URL로 돌려준다 — localStorage가 문자열만 받기 때문
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.onstop = () => {
          releaseMic()
          blobToDataUrl(new Blob(chunks, { type: recorder.mimeType })).then(
            resolve,
            reject,
          )
        }
        recorder.stop()
      }),
    cancel: () => {
      recorder.onstop = releaseMic
      if (recorder.state !== 'inactive') recorder.stop()
      else releaseMic()
    },
  }
}
