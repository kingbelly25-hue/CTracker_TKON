import { useState } from 'react'
import { MEETINGS, BLOCK_CATEGORIES, blocksOf, questionsOf } from '../data/content'
import { readiness, dueIds } from '../lib/srs'

// 미팅 화면 (화면명세 1장)
// 목록과 상세를 한 화면 안에서 전환한다 — 1단계는 미팅이 1개(노션)라 라우팅까지 갈 일이 아니다.

function MeetingCard({ meeting, percent, onSelect }) {
  return (
    <button type="button" className="card meeting-card" onClick={onSelect}>
      <div className="meeting-card-head">
        <h2>{meeting.title}</h2>
        <span className={`badge badge-${meeting.mode}`}>
          {meeting.mode === 'practice' ? '연습용' : '실전'}
        </span>
      </div>
      <p className="muted">{meeting.purpose}</p>
      <ProgressBar percent={percent} />
    </button>
  )
}

function ProgressBar({ percent }) {
  return (
    <div className="bar" role="img" aria-label={`준비도 ${percent}%`}>
      <div className="bar-fill" style={{ width: `${percent}%` }} />
    </div>
  )
}

function MeetingDetail({ meeting, records, onBack, onStartSend, onStartReceive }) {
  const blocks = blocksOf(meeting.id)
  const questions = questionsOf(meeting.id)

  const allIds = [...blocks, ...questions].map((item) => item.id)
  const percent = readiness(records, allIds)

  const dueBlocks = dueIds(
    records,
    blocks.map((b) => b.id),
  )
  const dueQuestions = dueIds(
    records,
    questions.map((q) => q.id),
  )

  // 카테고리별로 "복습 N개"만 센다. 총 개수는 안 보여준다 —
  // 총량은 압박감만 주고 진전감을 안 준다 (화면명세 1장 근거 3)
  const byCategory = BLOCK_CATEGORIES.map((category) => ({
    ...category,
    due: blocks.filter((b) => b.category === category.id && dueBlocks.includes(b.id))
      .length,
  })).filter((category) => category.due > 0)

  return (
    <section className="screen">
      <button type="button" className="back" onClick={onBack}>
        ← 미팅 목록
      </button>

      <header className="detail-head">
        <h1>{meeting.title}</h1>
        <p className="muted">{meeting.purpose}</p>
      </header>

      {/* 준비도% 상단 고정 (화면명세 1-2) */}
      <div className="card readiness">
        <p className="label">지금 들어가면</p>
        <p className="readiness-number">{percent}%</p>
        <ProgressBar percent={percent} />
      </div>

      {/* 말하기/듣기는 인지 자원이 달라 전환비용이 생긴다 → 시작 버튼을 나눈다 (화면명세 1장 근거 1) */}
      <div className="starts">
        <button
          type="button"
          className="start start-send"
          disabled={dueBlocks.length === 0}
          onClick={() => onStartSend(meeting.id)}
        >
          <span className="start-label">오늘 복습 — 말하기</span>
          <span className="start-count">
            {dueBlocks.length > 0 ? `${dueBlocks.length}개` : '오늘은 없음'}
          </span>
        </button>

        <button
          type="button"
          className="start start-receive"
          disabled={dueQuestions.length === 0}
          onClick={() => onStartReceive(meeting.id)}
        >
          <span className="start-label">오늘 복습 — 듣기</span>
          <span className="start-count">
            {dueQuestions.length > 0 ? `${dueQuestions.length}개` : '오늘은 없음'}
          </span>
        </button>
      </div>

      {byCategory.length > 0 && (
        <ul className="category-list">
          {byCategory.map((category) => (
            <li key={category.id}>
              <span>{category.label}</span>
              <span className="muted">복습 {category.due}개</span>
            </li>
          ))}
        </ul>
      )}

      {dueBlocks.length === 0 && dueQuestions.length === 0 && (
        <p className="muted done-note">오늘 몫은 다 했습니다. 내일 다시 밀려옵니다.</p>
      )}
    </section>
  )
}

export default function MeetingScreen({ records, onStartSend, onStartReceive }) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = MEETINGS.find((m) => m.id === selectedId)

  if (selected) {
    return (
      <MeetingDetail
        meeting={selected}
        records={records}
        onBack={() => setSelectedId(null)}
        onStartSend={onStartSend}
        onStartReceive={onStartReceive}
      />
    )
  }

  return (
    <section className="screen">
      <header className="detail-head">
        <h1>미팅</h1>
        <p className="muted">대비 중인 미팅</p>
      </header>

      <div className="meeting-list">
        {MEETINGS.map((meeting) => {
          const ids = [...blocksOf(meeting.id), ...questionsOf(meeting.id)].map(
            (item) => item.id,
          )
          return (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              percent={readiness(records, ids)}
              onSelect={() => setSelectedId(meeting.id)}
            />
          )
        })}
      </div>

      {/* 새 미팅 추가는 보류 — 4화면 전체 확정 후 마지막에 설계 (화면명세 1-1) */}
    </section>
  )
}
