import { useState } from 'react'
import { getPasscode, setPasscode } from '../lib/api'
import {
  getCode,
  isConfigured,
  isValidCode,
  newCode,
  normalizeCode,
  setCode,
} from '../lib/sync'

// 설정 화면 — 기기 연결과 접근 코드.
// 화면명세의 4화면 밖이다. 배관(동기화·배포)을 붙이면서 생긴 자리라
// 훈련 흐름을 건드리지 않게 별도 탭으로 뺐다.

export default function SettingsScreen({ syncStatus, onSyncNow }) {
  const [code, setCodeState] = useState(getCode)
  const [input, setInput] = useState('')
  const [pass, setPass] = useState(getPasscode)
  const [passSaved, setPassSaved] = useState(false)

  const applyCode = (value) => {
    setCode(value)
    setCodeState(value)
    setInput('')
  }

  const savePass = () => {
    setPasscode(pass.trim())
    setPassSaved(true)
  }

  return (
    <section className="screen">
      <header className="detail-head">
        <h1>설정</h1>
      </header>

      <div className="card settings-block">
        <p className="label">기기 연결</p>

        {!isConfigured && (
          <p className="muted notice">
            Firebase 설정이 없어 동기화가 꺼져 있습니다. 기록은 이 기기에만 저장됩니다.
          </p>
        )}

        {code ? (
          <>
            <p className="muted">이 코드를 다른 기기의 설정에 그대로 적으면 이어집니다.</p>
            <p className="sync-code">{code}</p>
            <p className="muted">{syncStatus}</p>
            <div className="starts">
              <button
                type="button"
                className="start start-send"
                onClick={onSyncNow}
                disabled={!isConfigured}
              >
                <span className="start-label">지금 동기화</span>
              </button>
              <button
                type="button"
                className="start start-receive"
                onClick={() => applyCode('')}
              >
                <span className="start-label">연결 끊기</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              새로 만들거나, 다른 기기에서 만든 코드를 적으세요. 기록은 코드 단위로
              묶입니다.
            </p>
            <button
              type="button"
              className="start start-send"
              onClick={() => applyCode(newCode())}
              disabled={!isConfigured}
            >
              <span className="start-label">새 연결 코드 만들기</span>
            </button>
            <input
              className="answer-input code-input"
              value={input}
              onChange={(e) => setInput(normalizeCode(e.target.value))}
              placeholder="기존 코드 입력"
              inputMode="text"
              autoCapitalize="characters"
            />
            <button
              type="button"
              className="start start-receive"
              disabled={!isValidCode(input) || !isConfigured}
              onClick={() => applyCode(input)}
            >
              <span className="start-label">이 코드로 연결</span>
            </button>
          </>
        )}
      </div>

      <div className="card settings-block">
        <p className="label">접근 코드</p>
        <p className="muted">
          판정·음원 서버를 쓰려면 필요합니다. 배포할 때 정한 값을 적으세요.
        </p>
        <input
          className="answer-input"
          type="password"
          value={pass}
          onChange={(e) => {
            setPass(e.target.value)
            setPassSaved(false)
          }}
          placeholder="접근 코드"
        />
        <button type="button" className="start start-receive" onClick={savePass}>
          <span className="start-label">{passSaved ? '저장했습니다' : '저장'}</span>
        </button>
      </div>

      <p className="muted notice">
        녹음(Before/After)은 동기화되지 않습니다. 이 기기에만 저장됩니다.
      </p>
    </section>
  )
}
