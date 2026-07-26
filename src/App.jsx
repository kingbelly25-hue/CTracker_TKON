import { useCallback, useEffect, useRef, useState } from 'react'
import MeetingScreen from './screens/MeetingScreen'
import SendTrainScreen from './screens/SendTrainScreen'
import ReceiveTrainScreen from './screens/ReceiveTrainScreen'
import ProgressScreen from './screens/ProgressScreen'
import SettingsScreen from './screens/SettingsScreen'
import { MEETINGS, blocksOf, questionsOf } from './data/content'
import { loadState, saveState } from './lib/storage'
import { readiness } from './lib/srs'
import { dayKey } from './lib/day'
import { getCode, isConfigured, mergeState, pull, push } from './lib/sync'
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
  { id: 'settings', label: '설정' },
]

// 훈련 도중 매 판정마다 올리면 쓰기 요금만 늘어난다. 잠잠해지면 한 번 올린다.
const PUSH_DELAY_MS = 3000

function App() {
  const [screen, setScreen] = useState('meeting')
  const [activeMeetingId, setActiveMeetingId] = useState(null)
  const [state, setState] = useState(loadState)
  const [syncStatus, setSyncStatus] = useState(
    isConfigured ? '아직 동기화하지 않았습니다.' : '동기화 꺼짐 (로컬 저장만)',
  )
  // 동기화 콜백이 최신 상태를 읽으려면 필요하다. 렌더 중에는 건드리지 않는다.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    saveState(state)
  }, [state])

  const syncNow = useCallback(async () => {
    const code = getCode()
    if (!isConfigured || !code) return
    setSyncStatus('동기화 중…')
    try {
      // 올리기 전에 먼저 받아 합친다 — 다른 기기 진도를 덮어쓰지 않게
      const merged = mergeState(stateRef.current, await pull(code))
      setState(merged)
      await push(code, merged)
      setSyncStatus(`${new Date().toLocaleTimeString('ko-KR')} 동기화됨`)
    } catch (e) {
      setSyncStatus(`동기화 실패: ${e.message}`)
    }
  }, [])

  // 앱을 열 때 한 번 맞춘다. 첫 렌더를 막지 않게 커밋 뒤로 미룬다.
  useEffect(() => {
    if (!isConfigured || !getCode()) return undefined
    const timer = setTimeout(syncNow, 0)
    return () => clearTimeout(timer)
  }, [syncNow])

  // 기록이 바뀌면 잠잠해진 뒤 한 번만 올린다
  useEffect(() => {
    const code = getCode()
    if (!isConfigured || !code) return undefined
    const timer = setTimeout(() => {
      push(code, stateRef.current)
        .then(() => setSyncStatus(`${new Date().toLocaleTimeString('ko-KR')} 저장됨`))
        .catch((e) => setSyncStatus(`올리기 실패: ${e.message}`))
    }, PUSH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state.records, state.history, state.flags])

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
        {screen === 'settings' && (
          <SettingsScreen syncStatus={syncStatus} onSyncNow={syncNow} />
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
