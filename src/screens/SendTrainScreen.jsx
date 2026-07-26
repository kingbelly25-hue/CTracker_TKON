import { useEffect, useRef, useState } from 'react'
import { BLOCK_CATEGORIES, blocksOf } from '../data/content'
import { dueIds, getRecord, grade } from '../lib/srs'
import { judgeSend, JUDGE_TIMEOUT_MS } from '../lib/gemini'

// 송신 훈련 화면 (화면명세 2장)
// 한글 트리거 → 영어 인출 → 판정 → SRS 갱신.
// 정답은 입력 후에만 보여준다 — 먼저 보여주면 인출이 아니라 재인이 된다.

// 이 시간이 지나면 "건너뛰기"를 노출한다. 무료 티어가 느릴 때 세션이 막히지 않게.
const SKIP_HINT_MS = 8000

const categoryLabel = (id) =>
  BLOCK_CATEGORIES.find((category) => category.id === id)?.label ?? id

function shuffle(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function SendTrainScreen({
  meetingId,
  records,
  onUpdateRecord,
  onFlagJudgement,
  onDone,
}) {
  // 세션 목록은 진입 시 한 번만 고정한다. 카테고리를 섞어 제시해야 실전 조립력이 는다.
  const [queue] = useState(() => {
    const blocks = blocksOf(meetingId)
    const due = dueIds(
      records,
      blocks.map((b) => b.id),
    )
    return shuffle(blocks.filter((b) => due.includes(b.id)))
  })

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('input') // input | judging | result | error
  const [input, setInput] = useState('')
  const [verdict, setVerdict] = useState(null)
  const [error, setError] = useState(null)
  const [showSkip, setShowSkip] = useState(false)
  const [flagged, setFlagged] = useState(false)
  const abortRef = useRef(null)

  const current = queue[index]

  useEffect(() => {
    if (phase !== 'judging') return undefined
    const timer = setTimeout(() => setShowSkip(true), SKIP_HINT_MS)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => () => abortRef.current?.abort(), [])

  if (!current) {
    return (
      <section className="screen">
        <header className="detail-head">
          <h1>말하기</h1>
        </header>
        <p className="muted">
          {queue.length === 0
            ? '오늘 밀린 블록이 없습니다.'
            : `${queue.length}개 끝냈습니다. 오늘 몫 완료.`}
        </p>
        <button type="button" className="start start-send" onClick={onDone}>
          <span className="start-label">미팅으로 돌아가기</span>
        </button>
      </section>
    )
  }

  const applyResult = (result) => {
    onUpdateRecord(current.id, grade(getRecord(records, current.id), result))
  }

  const next = () => {
    setIndex((i) => i + 1)
    setInput('')
    setVerdict(null)
    setError(null)
    setShowSkip(false)
    setFlagged(false)
    setPhase('input')
  }

  const submit = async () => {
    if (!input.trim()) return

    setPhase('judging')
    setError(null)
    setShowSkip(false)

    const controller = new AbortController()
    abortRef.current = controller
    const timeout = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS)

    try {
      const result = await judgeSend(
        { trigger: current.trigger, answer: current.answer, userInput: input },
        controller.signal,
      )
      setVerdict(result)
      applyResult(result.result === 'pass' ? 'pass' : 'fail')
      setPhase('result')
    } catch (e) {
      setError(
        e.name === 'AbortError' ? '판정이 너무 오래 걸립니다.' : e.message,
      )
      setPhase('error')
    } finally {
      clearTimeout(timeout)
    }
  }

  // 판정 없이 넘긴다 — SRS를 갱신하지 않으므로 이 블록은 계속 복습 대상으로 남는다
  const skipWithoutJudging = () => {
    abortRef.current?.abort()
    next()
  }

  const flag = () => {
    setFlagged(true)
    onFlagJudgement?.({
      blockId: current.id,
      input,
      verdict,
      at: new Date().toISOString(),
    })
  }

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

      <div className="card trigger-card">
        <p className="label">{categoryLabel(current.category)}</p>
        <p className="trigger">{current.trigger}</p>
      </div>

      {phase === 'input' && (
        <>
          <textarea
            className="answer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="영어로 입력"
            rows={4}
            autoFocus
          />
          <button
            type="button"
            className="start start-send"
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
              건너뛰고 다음으로 (이 블록은 다음에 다시 나옵니다)
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
            <button type="button" className="start start-send" onClick={submit}>
              <span className="start-label">다시 판정</span>
            </button>
            <button
              type="button"
              className="start start-receive"
              onClick={skipWithoutJudging}
            >
              <span className="start-label">건너뛰기</span>
            </button>
          </div>
        </>
      )}

      {phase === 'result' && (
        <>
          {verdict && (
            <div
              className={`card verdict ${
                verdict.result === 'pass' ? 'verdict-pass' : 'verdict-fail'
              }`}
            >
              <p className="label">{verdict.result === 'pass' ? '성공' : '보완'}</p>
              <p>{verdict.comment}</p>
            </div>
          )}

          <div className="card">
            <p className="label">내가 쓴 것</p>
            <p className="user-input">{input}</p>
          </div>

          {verdict?.correction && verdict.correction !== input && (
            <div className="card">
              <p className="label">다듬으면</p>
              <p className="answer-text">{verdict.correction}</p>
            </div>
          )}

          <div className="card">
            <p className="label">정답 예시</p>
            <p className="answer-text">{current.answer}</p>
          </div>

          <button type="button" className="start start-send" onClick={next}>
            <span className="start-label">다음</span>
          </button>

          {/* 판정 오류 사례 기록용. 즉시 재판정 기능이 아니다 (화면명세 2장) */}
          <button type="button" className="back center" onClick={flag} disabled={flagged}>
            {flagged ? '기록했습니다' : '이 판정이 이상한가요?'}
          </button>
        </>
      )}
    </section>
  )
}
