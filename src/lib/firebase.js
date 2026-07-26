// Firebase 초기화 (기획서 7장 — CutTracker 배관 이식).
//
// 설정값은 .env에서 읽는다. Firebase 웹 설정은 원래 공개되는 값이라 비밀은 아니지만,
// 프로젝트를 갈아끼울 때 코드를 안 고치려고 환경변수로 뺐다.
// 실제 접근 통제는 Firestore 보안 규칙(firestore.rules)이 한다.
//
// SDK는 동적 import로 늦게 불러온다. 훈련 화면은 Firebase를 쓰지 않는데
// 정적 import를 하면 첫 화면 로딩에 500KB가 얹힌다.

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// 설정이 없으면 앱은 localStorage만으로 정상 동작한다. 동기화 기능만 꺼진다.
export const isConfigured = Boolean(config.apiKey && config.projectId)

let cached = null

export function loadFirestore() {
  if (!isConfigured) return Promise.reject(new Error('Firebase 설정이 없습니다'))
  if (!cached) {
    cached = Promise.all([import('firebase/app'), import('firebase/firestore')]).then(
      ([{ initializeApp }, firestore]) => ({
        db: firestore.getFirestore(initializeApp(config)),
        firestore,
      }),
    )
  }
  return cached
}
