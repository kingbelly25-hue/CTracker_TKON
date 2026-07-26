import { useCallback, useEffect, useRef, useState } from 'react'
import { BENCHMARK_LOCK_DAYS, MEETINGS, blocksOf, questionsOf } from '../data/content'
import { readiness } from '../lib/srs'
import { dayKey, daysSince, shiftDays } from '../lib/day'
import { MAX_SECONDS, canRecord, startRecording } from '../lib/recorder'

// 성과 화면 (화면명세 4장) — 이 앱의 심장.
// 순서가 곧 설계다: 매일 움직이는 지표를 위에, 2주 뒤에야 열리는 증거를 아래에.
// 콜드스타트(첫 2주)에 빈 화면이 뜨지 않게 각 블록이 자기 빈 상태를 갖는다.

const TREND_DAYS = 14

// 단색 추세선. 축·범례·눈금 없음 (화면명세 4장).
// 계열이 하나라 범례가 필요 없고, 값은 끝점에만 직접 붙인다.
function Sparkline({ points }) {
  const W = 400
  const H = 60
  const PAD = 8

  const x = (i) =>
    points.length === 1
      ? W / 2
      : PAD + (i * (W - PAD * 2)) / (points.length - 1)
  // y축은 0~100%로 고정한다. 데이터 범위에 맞춰 늘이면 3%p 변화가 절벽처럼 보인다.
  const y = (rate) => H - PAD - (rate / 100) * (H - PAD * 2)

  const path = points.map((p, i) => `${x(i)},${y(p.rate)}`).join(' ')
  const last = points[points.length - 1]

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`최근 ${points.length}일 인출 성공률 추이: ${points
        .map((p) => `${p.day} ${p.rate}%`)
        .join(', ')}`}
    >
      <polyline
        points={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 끝점 마커 — 표면색 링을 둘러 선 위에서도 읽히게 한다 */}
      <circle
        cx={x(points.length - 1)}
        cy={y(last.rate)}
        r="4"
        fill="var(--accent)"
        stroke="var(--bg)"
        strokeWidth="2"
      />
    </svg>
  )
}

function ReadinessBlock({ history, percent }) {
  const lastWeek = history[shiftDays(dayKey(), -7)]
  const delta = lastWeek ? percent - lastWeek.readiness : null

  return (
    <div className="card readiness">
      <p className="label">지금 미팅에 들어가면</p>
      <p className="hero-number">{percent}%</p>
      {/* 비교 대상이 없는 첫 주엔 변화량 대신 "첫 기록"을 보여준다 (화면명세 4장) */}
      {delta === null ? (
        <p className="muted">오늘 첫 기록</p>
      ) : (
        <p className="muted">
          지난주보다 {delta > 0 ? '+' : ''}
          {delta}%
        </p>
      )}
    </div>
  )
}

function TrendBlock({ history }) {
  const today = dayKey()
  const points = []
  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    const day = shiftDays(today, -i)
    const entry = history[day]
    if (entry?.attempts) {
      points.push({ day, rate: Math.round((entry.successes / entry.attempts) * 100) })
    }
  }

  return (
    <div className="card">
      <p className="label">인출 성공률 추이</p>
      {points.length < 2 ? (
        <p className="muted">
          이틀 이상 훈련하면 선이 그려집니다. (지금 {points.length}일)
        </p>
      ) : (
        <>
          <Sparkline points={points} />
          {/* 끝점만 직접 라벨링. 값 텍스트는 계열색이 아니라 텍스트 색을 쓴다 */}
          <p className="trend-value">{points[points.length - 1].rate}%</p>
        </>
      )}
    </div>
  )
}

function Recorder({ label, onSaved }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState(null)
  const handleRef = useRef(null)

  const stop = useCallback(async () => {
    const handle = handleRef.current
    handleRef.current = null
    setRecording(false)
    if (!handle) return
    try {
      onSaved(await handle.stop())
    } catch (e) {
      setError(e.message)
    }
  }, [onSaved])

  useEffect(() => {
    if (!recording) return undefined
    const ticker = setInterval(() => setSeconds((s) => s + 1), 1000)
    // 상한을 넘기면 알아서 끊는다 — 긴 녹음은 localStorage를 통째로 잡아먹는다
    const cutoff = setTimeout(stop, MAX_SECONDS * 1000)
    return () => {
      clearInterval(ticker)
      clearTimeout(cutoff)
    }
  }, [recording, stop])

  useEffect(() => () => handleRef.current?.cancel(), [])

  const start = async () => {
    setError(null)
    setSeconds(0)
    try {
      handleRef.current = await startRecording()
      setRecording(true)
    } catch {
      setError('마이크를 쓸 수 없습니다. 브라우저 권한을 확인하세요.')
    }
  }

  if (!canRecord) {
    return <p className="muted notice">이 브라우저는 녹음을 지원하지 않습니다.</p>
  }

  return (
    <>
      <button
        type="button"
        className={recording ? 'start start-receive' : 'start start-send'}
        onClick={recording ? stop : start}
      >
        <span className="start-label">{recording ? '■  녹음 멈추기' : label}</span>
        {recording && (
          <span className="start-count">
            {seconds}초 / {MAX_SECONDS}초
          </span>
        )}
      </button>
      {error && <p className="muted notice">{error}</p>}
    </>
  )
}

function BenchmarkBlock({ meeting, recordings, onSaveRecording }) {
  const before = recordings?.before
  const after = recordings?.after
  const elapsed = before ? daysSince(before.at) : 0
  const remaining = BENCHMARK_LOCK_DAYS - elapsed
  const unlocked = before && remaining <= 0

  return (
    <div className="card benchmark">
      <p className="label">Before / After</p>

      {!before && (
        <>
          <p className="muted">{meeting.benchmark.instruction}</p>
          <p className="answer-text">{meeting.benchmark.text}</p>
          <Recorder
            label="●  시작 녹음하기"
            onSaved={(data) => onSaveRecording(meeting.id, 'before', data)}
          />
        </>
      )}

      {/* 처음부터 열어두지 않는다 — 기대감을 만들고 공개 순간의 임팩트를 지킨다 */}
      {before && !unlocked && (
        <div className="locked">
          <p className="locked-count">D-{remaining}</p>
          <p className="muted">{remaining}일 뒤에 열립니다.</p>
          <p className="muted">시작 녹음은 저장돼 있습니다. 그때 나란히 들어보세요.</p>
        </div>
      )}

      {unlocked && !after && (
        <>
          <p className="muted">
            2주가 지났습니다. 같은 문단을 다시 녹음하면 나란히 들을 수 있습니다.
          </p>
          <p className="answer-text">{meeting.benchmark.text}</p>
          <Recorder
            label="●  지금 녹음하기"
            onSaved={(data) => onSaveRecording(meeting.id, 'after', data)}
          />
        </>
      )}

      {unlocked && after && (
        <div className="compare">
          <div>
            <p className="label">{elapsed}일 전 — Before</p>
            <audio controls src={before.data} />
          </div>
          <div>
            <p className="label">오늘 — After</p>
            <audio controls src={after.data} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProgressScreen({ meetingId, state, onSaveRecording }) {
  const meeting = MEETINGS.find((m) => m.id === meetingId) ?? MEETINGS[0]
  const ids = [...blocksOf(meeting.id), ...questionsOf(meeting.id)].map((i) => i.id)
  const percent = readiness(state.records, ids)

  return (
    <section className="screen">
      <header className="detail-head">
        <h1>성과</h1>
        <p className="muted">{meeting.title}</p>
      </header>

      <ReadinessBlock history={state.history} percent={percent} />
      <TrendBlock history={state.history} />
      <BenchmarkBlock
        meeting={meeting}
        recordings={state.recordings[meeting.id]}
        onSaveRecording={onSaveRecording}
      />
    </section>
  )
}
