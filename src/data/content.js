// 미팅 콘텐츠 (기획서 9장 — 콘텐츠는 코드와 분리)
//
// 1단계 시작 콘텐츠는 전부 "범용 연습용"이다 (기획서 8장).
// 회사명·수치·전략은 [업종] [금액] 식 자리표시자로 빼고 뉘앙스만 남긴다 (기획서 6장).
// 실전 대본(mode: 'live')은 API로 보내지 않는다 — 분류 책임은 사용자에게 있다.

export const MEETINGS = [
  {
    id: 'notion',
    title: '노션 글로벌 파트너십',
    purpose: '협력방안 논의',
    mode: 'practice', // 'practice' = API 사용 가능 | 'live' = API 격리, 텍스트 저장만
    startedAt: '2026-07-26',
    targetDate: null, // 3개월 내, 날짜 미정 (기획서 2장)

    // Before/After 대조용 고정 대본. 2주 간격으로 "같은 문장"을 읽어야 비교가 성립한다.
    benchmark: {
      instruction:
        '아래 문단을 소리 내어 읽고 녹음하세요. 2주 뒤 같은 문단을 다시 녹음해 나란히 듣습니다.',
      text: "Thanks for making time today. We're a [industry] company, and what I'd like to explore is where our two sides fit together. I'll walk you through what we can bring, and then I'd like to hear how you're thinking about it.",
    },
  },
]

// 잠금 기간 — 2주 뒤에 열린다 (기획서 5장 ①)
export const BENCHMARK_LOCK_DAYS = 14

// 송신축 블록 카테고리 (기획서 3장)
export const BLOCK_CATEGORIES = [
  { id: 'opening', label: '오프닝' },
  { id: 'message', label: '핵심 메시지' },
  { id: 'qa', label: 'Q&A 답변' },
  { id: 'bridge', label: '연결 표현' },
]

// 송신 훈련용 블록 — 한글 트리거로 영어를 인출한다
export const BLOCKS = [
  {
    id: 'b-open-1',
    meetingId: 'notion',
    category: 'opening',
    trigger: '저희는 [업종] 하는 회사고, 이 바닥에서 [N]년 됐습니다',
    answer: "We're a [industry] company, and we've been in this space for about [N] years.",
  },
  {
    id: 'b-open-2',
    meetingId: 'notion',
    category: 'opening',
    trigger: '오늘은 저희가 보는 접점을 설명드리고, 그쪽 생각을 듣고 싶습니다',
    answer:
      "What I'd like to do today is walk you through where we see a fit, and then hear how you're thinking about it.",
  },
  {
    id: 'b-msg-1',
    meetingId: 'notion',
    category: 'message',
    trigger: '저희가 드릴 수 있는 건 [자산]이고, 거기서 가장 도움이 될 겁니다',
    answer:
      "What we can bring to the table is [asset] — that's where we think we add the most value.",
  },
  {
    id: 'b-msg-2',
    meetingId: 'notion',
    category: 'message',
    trigger: '저희가 그쪽에 바라는 건 [요청]입니다',
    answer: "What we're hoping to get from your side is [request].",
  },
  {
    id: 'b-qa-1',
    meetingId: 'notion',
    category: 'qa',
    trigger: '아직 확정 전이라 오늘 숫자를 못 박기는 조심스럽습니다',
    answer:
      "That's still being finalized on our end, so I'd rather not commit to a number today.",
  },
  {
    id: 'b-qa-2',
    meetingId: 'notion',
    category: 'qa',
    trigger: '맞는 지적이고, 사실 저희도 아직 정리 중인 부분입니다',
    answer:
      "That's a fair point — honestly, it's something we're still working through ourselves.",
  },
  {
    id: 'b-br-1',
    meetingId: 'notion',
    category: 'bridge',
    trigger: '좋은 지적이고, 마침 제가 꺼내려던 얘기와 이어집니다',
    answer:
      "That's a good point, and it actually connects to something I wanted to raise.",
  },
  {
    id: 'b-br-2',
    meetingId: 'notion',
    category: 'bridge',
    trigger: '제가 제대로 이해했는지 확인 좀 하겠습니다',
    answer: "Just so I make sure I'm following you correctly —",
  },
]

// 수신 훈련용 질문 — IR/파트너십 미팅 빈출 패턴 (기획서 3장)
// gist = 채점 기준이 되는 한국어 요지. 받아쓰기가 아니라 요지만 맞으면 된다.
export const QUESTIONS = [
  {
    id: 'q-1',
    meetingId: 'notion',
    text: 'So what does success look like for you six months into this partnership?',
    gist: '이 파트너십 6개월 시점의 성공 기준이 뭐냐',
  },
  {
    id: 'q-2',
    meetingId: 'notion',
    text: "How does this fit with what you're already doing in the region?",
    gist: '이미 이 지역에서 하고 있는 것과 어떻게 맞물리냐',
  },
  {
    id: 'q-3',
    meetingId: 'notion',
    text: 'Who on your side would actually own this day to day?',
    gist: '그쪽에서 실무를 매일 맡을 사람이 누구냐',
  },
  {
    id: 'q-4',
    meetingId: 'notion',
    text: 'What kind of commitment are you looking for from us at this stage?',
    gist: '현 단계에서 우리 쪽에 원하는 커밋 수준이 뭐냐',
  },
  {
    id: 'q-5',
    meetingId: 'notion',
    text: "We've been burned by similar deals before — what's different here?",
    gist: '비슷한 딜로 데인 적 있다, 이번엔 뭐가 다르냐',
  },
]

export const blocksOf = (meetingId) => BLOCKS.filter((b) => b.meetingId === meetingId)
export const questionsOf = (meetingId) =>
  QUESTIONS.filter((q) => q.meetingId === meetingId)
