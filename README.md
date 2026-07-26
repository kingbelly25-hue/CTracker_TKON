# TKon — 영어 미팅 대비 앱

미팅 대비 블록 훈련기 + 성과 가시화기.
기획 의도와 화면 설계 근거는 [docs/](docs/) 참고.

- 배포: https://c-tracker-tkon.vercel.app/
- 스택: Vite + React / Vercel 서버리스 함수 / Firestore / Gemini API

---

## 다른 PC에서 이어서 작업하기

### 1. 준비물 설치

- [Node.js](https://nodejs.org) LTS 버전
- [Git](https://git-scm.com)

### 2. 저장소 받기

```bash
git clone https://github.com/kingbelly25-hue/CTracker_TKON.git
cd CTracker_TKON
npm install
```

### 3. 커밋 신원 설정 (이 저장소에만 적용)

안 하면 Git이 OS 계정 정보를 추측해서 쓴다. 회사 PC라면 회사 메일·소속이
공개 저장소에 박히므로 클론 직후 바로 설정할 것.

```bash
git config --local user.name "kingbelly25-hue"
git config --local user.email "284844839+kingbelly25-hue@users.noreply.github.com"
```

### 4. `.env` 만들기

`.env`는 커밋되지 않으므로 PC마다 직접 만들어야 한다.
`.env.example`을 복사한 뒤 값을 채운다.

```bash
cp .env.example .env
```

값을 가져올 곳:

| 항목 | 어디서 |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) 또는 Vercel 환경변수 |
| `APP_PASSCODE` | Vercel > Settings > Environment Variables (앱 설정 탭에 넣는 값과 동일) |
| `VITE_FIREBASE_*` | [Firebase 콘솔](https://console.firebase.google.com) > 톱니바퀴 > 일반 > 내 앱 > 웹 앱 > SDK 설정 |

주의: 값 뒤에 주석이나 설명을 적지 말 것. `=` 다음부터 줄 끝까지가 전부 값이다.

### 5. 실행

```bash
npm run dev
```

`/api/*` 서버리스 함수도 개발서버에서 같이 돈다 (`vercel dev` 불필요).

---

## 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발서버 (API 함수 포함) |
| `npm run build` | 프로덕션 빌드 → `dist/` |
| `npm run lint` | ESLint |

---

## 학습 기록 이어받기

훈련 기록은 기기의 localStorage에 있고, **연결 코드**로 Firestore를 통해 동기화된다.

1. 기존 PC의 앱 > **설정** 탭에서 6자리 연결 코드 확인
2. 새 PC의 앱 > **설정** 탭에 그 코드 입력
3. 같은 화면에서 **접근 코드**도 입력해야 판정·음원이 동작한다

**Before/After 녹음은 동기화되지 않는다** (기획서 7장). 녹음한 기기에서만 재생된다.

---

## 구조

```
api/            Vercel 서버리스 함수 — Gemini 호출을 서버에 가둔다
  judge.js        송신·수신 판정 (프롬프트도 서버가 조립)
  tts.js          음원 생성
src/
  data/content.js 미팅·블록·질문 콘텐츠 (코드와 분리)
  lib/            srs·storage·sync·recorder·tts 등 계층
  screens/        미팅 / 송신 / 수신 / 성과 / 설정
firestore.rules   Firebase 콘솔에 붙여넣는 보안 규칙 (콘솔이 진짜, 이 파일은 기록용)
```

### API 키를 서버에 두는 이유

유료 선불 키라 유출이 곧 금전 손실이다. 그래서:

- 키 이름에 `VITE_` 접두사를 쓰지 않는다 → 클라이언트 번들에 들어갈 경로 자체가 없다
- 프롬프트를 서버가 조립한다 → 이 엔드포인트가 남의 범용 LLM으로 쓰이는 것을 막는다
- `APP_PASSCODE` 헤더가 맞아야 응답한다 → 배포 주소를 아는 제3자의 무단 호출 차단

`VITE_FIREBASE_*`는 반대로 원래 브라우저에 공개되는 값이다.
실제 접근 통제는 `firestore.rules`가 한다.
