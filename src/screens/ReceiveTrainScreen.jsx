import { useEffect, useRef, useState } from 'react'
import { questionsOf } from '../data/content'
import { dueIds, getRecord, grade } from '../lib/srs'
import { judgeReceive, JUDGE_TIMEOUT_MS } from '../lib/gemini'
import { canSpeakLocally, getAudioUrl, speakLocally, stopLocalSpeech } from '../lib/tts'

// 수신 훈련 화면 (화면명세 3장)
// 음원 듣기 → 요지 한 줄 → 3단계 판정 → 원문 공개.
// 받아쓰기가 아니라 요지 파악이다. 원문은 판정 후에만 보여준다.

const SKIP_HINT_MS = 8000

const RESULT_LABEL = {
  pass: '완전 파악',
  partial: '일부만 파악',
  fail: '놓침',
}

function shuffle(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function ReceiveTrainScreen({
  meetingId,
  records,
  onUpdateRecord,
  onDone,
}) {
  const [queue] = useState(() => {
    const questions = questionsOf(meetingId)
    const due = dueIds(
      records,
      questions.map((q) => q.id),
    )
    return shuffle(questions.filter((q) => due.includes(q.id)))
  })

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('listen') // listen | judging | result | error
  const [input, setInput] = useState('')
  const [verdict, setVerdict] = useState(null)
  const [error, setError] = useState(null)
  const [showSkip, setShowSkip] = useState(false)

  const [audioUrl, setAudioUrl] = useState(null)
  const [audioState, setAudioState] = useState('loading')
  const [ttsError, setTtsError] = useState(null)

  const audioRef = useRef(null)
  const abortRef = useRef(null)

  const current = queue[index]

  // 음원은 질문이 바뀔 때 한 번만 만든다. 이후 재생은 캐시에서 — 다시 듣기는 무제한이다.
  useEffect(() => {
    if (!current) return undefined

    let cancelled = false
    const controller = new AbortController()

    getAudioUrl(current.id, current.text, controller.signal)
      .then((url) => {
        if (cancelled) return
        setAudioUrl(url)
        setAudioState('ready')
      })
      .catch((e) => {
        if (cancelled || e.name === 'AbortError') return
        // 음원 생성이 막혀도 세션은 굴러가야 한다 → 브라우저 내장 음성으로 떨어진다
        setTtsError(e.message)
        setAudioState('local')
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [current])

  useEffect(() => {
    if (phase !== 'judging') return undefined
    const timer = setTimeout(() => setShowSkip(true), SKIP_HINT_MS)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => () => {
    abortRef.current?.abort()
    stopLocalSpeech()
  }, [])

  if (!current) {
    return (
      <section className="screen">
        <header className="detail-head">
          <h1>듣기</h1>
        </header>
        <p className="muted">
          {queue.length === 0
            ? '오늘 밀린 질문이 없습니다.'
            : `${queue.length}개 끝냈습니다. 오늘 몫 완료.`}
        </p>
        <button type="button" className="start start-send" onClick={onDone}>
          <span className="start-label">미팅으로 돌아가기</span>
        </button>
      </section>
    )
  }

  const play = () => {
    if (audioState === 'ready' && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
    } else if (audioState === 'local') {
      speakLocally(current.text)
    }
  }

  const applyResult = (result) => {
    onUpdateRecord(current.id, grade(getRecord(records, current.id), result))
  }

  const next = () => {
    stopLocalSpeech()
    setIndex((i) => i + 1)
    setInput('')
    setVerdict(null)
    setError(null)
    setShowSkip(false)
    setAudioUrl(null)
    setAudioState('loading')
    setTtsError(null)
    setPhase('listen')
  }

  const submit = async () => {
    if (!input.trim()) return
    stopLocalSpeech()

    setPhase('judging')
    setError(null)
    setShowSkip(false)

    const controller = new AbortController()
    abortRef.current = controller
    const timeout = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS)

    try {
      const result = await judgeReceive(
        { text: current.text, gist: current.gist, userInput: input },
        controller.signal,
      )
      setVerdict(result)
      applyResult(result.result)
      setPhase('result')
    } catch (e) {
      setError(e.name === 'AbortError' ? '판정이 너무 오래 걸립니다.' : e.message)
      setPhase('error')
    } finally {
      clearTimeout(timeout)
    }
  }

  const skipWithoutJudging = () => {
    abortRef.current?.abort()
    next()
  }

  const verdictClass =
    verdict?.result === 'pass'
      ? 'verdict-pass'
      : verdict?.result === 'partial'
        ? 'verdict-partial'
        : 'verdict-fail'

  return (
    <section className="screen">
      <div className="session-head">
        <span className="muted">
          {index + 1} / {queue.length}
        </span>
        <button type="button" className="back" onClick={onDone}>
          그만두기
        </button>
      </div>

      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      {phase === 'listen' && (
        <>
          <div className="card listen-card">
            <p className="label">질문 듣기</p>
            <button
              type="button"
              className="play"
              onClick={play}
              disabled={audioState === 'loading'}
            >
              {audioState === 'loading' ? '음원 준비 중…' : '▶  재생'}
            </button>
            <p className="muted">다시 듣기는 제한 없습니다.</p>
          </div>

          {audioState === 'local' && (
            <p className="muted notice">
              음원 생성 실패 — 브라우저 내장 음성으로 재생합니다.
              {ttsError ? ` (${ttsError})` : ''}
              {!canSpeakLocally && ' 이 브라우저는 내장 음성도 지원하지 않습니다.'}
            </p>
          )}

          <div className="card">
            <p className="label">뭘 묻는 질문이었나요?</p>
            <textarea
              className="answer-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="핵심만 한 줄. 한국어로 써도 됩니다."
              rows={3}
            />
          </div>

          <button
            type="button"
            className="start start-receive"
            disabled={!input.trim()}
            onClick={submit}
          >
            <span className="start-label">판정 받기</span>
          </button>
        </>
      )}

      {phase === 'judging' && (
        <>
          <div className="card judging">
            <p className="label">판정 중</p>
            <p className="user-input">{input}</p>
          </div>
          {showSkip && (
            <button type="button" className="back center" onClick={skipWithoutJudging}>
              건너뛰고 다음으로 (이 질문은 다음에 다시 나옵니다)
            </button>
          )}
        </>
      )}

      {phase === 'error' && (
        <>
          <div className="card verdict verdict-fail">
            <p className="label">판정 실패</p>
            <p>{error}</p>
          </div>
          <div className="starts">
            <button type="button" className="start start-receive" onClick={submit}>
              <span className="start-label">다시 판정</span>
            </button>
            <button type="button" className="start start-send" onClick={skipWithoutJudging}>
              <span className="start-label">건너뛰기</span>
            </button>
          </div>
        </>
      )}

      {phase === 'result' && (
        <>
          {verdict && (
            <>
              <div className={`card verdict ${verdictClass}`}>
                <p className="label">{RESULT_LABEL[verdict.result]}</p>
                <p>{verdict.comment}</p>
              </div>
              {verdict.missed && (
                <div className="card">
                  <p className="label">놓친 부분</p>
                  <p>{verdict.missed}</p>
                </div>
              )}
            </>
          )}

          {/* 원문 전체 공개 — 판정 근거를 눈으로 확인해야 신뢰가 생긴다 (화면명세 3장) */}
          <div className="card">
            <p className="label">원문</p>
            <p className="answer-text">{current.text}</p>
            <p className="muted">{current.gist}</p>
          </div>

          <button type="button" className="start start-receive" onClick={next}>
            <span className="start-label">다음</span>
          </button>
        </>
      )}
    </section>
  )
}
