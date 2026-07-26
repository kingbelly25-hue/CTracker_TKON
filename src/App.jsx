import { useCallback, useEffect, useState } from 'react'
import MeetingScreen from './screens/MeetingScreen'
import SendTrainScreen from './screens/SendTrainScreen'
import ReceiveTrainScreen from './screens/ReceiveTrainScreen'
import ProgressScreen from './screens/ProgressScreen'
import { MEETINGS, blocksOf, questionsOf } from './data/content'
import { loadState, saveState } from './lib/storage'
import { readiness } from './lib/srs'
import { dayKey } from './lib/day'
import './App.css'

// 준비도%는 미팅의 모든 블록·질문을 한 덩어리로 본다 (기획서 5장 ② — 단일 숫자)
const ALL_ITEM_IDS = MEETINGS.flatMap((meeting) =>
  [...blocksOf(meeting.id), ...questionsOf(meeting.id)].map((item) => item.id),
)

const TABS = [
  { id: 'meeting', label: '미팅' },
  { id: 'send', label: '말하기' },
  { id: 'receive', label: '듣기' },
  { id: 'progress', label: '성과' },
]

function App() {
  const [screen, setScreen] = useState('meeting')
  const [activeMeetingId, setActiveMeetingId] = useState(null)
  const [state, setState] = useState(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  // 훈련 화면이 판정 결과로 SRS 레코드를 갱신하는 통로.
  // 모든 판정이 여기로 모이므로, 성과 화면이 쓸 일별 기록도 같이 남긴다.
  const updateRecord = useCallback((id, record) => {
    setState((prev) => {
      const records = { ...prev.records, [id]: record }
      const wasSuccess = record.successes > (prev.records[id]?.successes ?? 0)
      const today = dayKey()
      const entry = prev.history[today] ?? { attempts: 0, successes: 0 }

      return {
        ...prev,
        records,
        history: {
          ...prev.history,
          [today]: {
            attempts: entry.attempts + 1,
            successes: entry.successes + (wasSuccess ? 1 : 0),
            readiness: readiness(records, ALL_ITEM_IDS),
          },
        },
      }
    })
  }, [])

  const saveRecording = useCallback((meetingId, slot, dataUrl) => {
    setState((prev) => ({
      ...prev,
      recordings: {
        ...prev.recordings,
        [meetingId]: {
          ...prev.recordings[meetingId],
          [slot]: { data: dataUrl, at: dayKey() },
        },
      },
    }))
  }, [])

  // 판정이 이상하다는 신고를 쌓아둔다 — 즉시 재판정은 안 한다 (화면명세 2장)
  const flagJudgement = useCallback((flag) => {
    setState((prev) => ({ ...prev, flags: [...prev.flags, flag] }))
  }, [])

  const startTraining = (mode) => (meetingId) => {
    setActiveMeetingId(meetingId)
    setScreen(mode)
  }

  return (
    <>
      <main className="app">
        {screen === 'meeting' && (
          <MeetingScreen
            records={state.records}
            onStartSend={startTraining('send')}
            onStartReceive={startTraining('receive')}
          />
        )}
        {screen === 'send' && (
          <SendTrainScreen
            meetingId={activeMeetingId ?? MEETINGS[0].id}
            records={state.records}
            onUpdateRecord={updateRecord}
            onFlagJudgement={flagJudgement}
            onDone={() => setScreen('meeting')}
          />
        )}
        {screen === 'receive' && (
          <ReceiveTrainScreen
            meetingId={activeMeetingId ?? MEETINGS[0].id}
            records={state.records}
            onUpdateRecord={updateRecord}
            onDone={() => setScreen('meeting')}
          />
        )}
        {screen === 'progress' && (
          <ProgressScreen
            meetingId={activeMeetingId ?? MEETINGS[0].id}
            state={state}
            onSaveRecording={saveRecording}
          />
        )}
      </main>

      <nav className="tabbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={screen === tab.id ? 'tab active' : 'tab'}
            onClick={() => setScreen(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  )
}

export default App
