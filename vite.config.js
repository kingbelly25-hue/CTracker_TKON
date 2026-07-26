import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 중에도 /api/* 가 돌게 한다.
// Vercel 서버리스 함수는 배포 환경에서만 실행되므로, 같은 핸들러 파일을
// 로컬 개발서버 미들웨어로 그대로 불러 쓴다 (구현이 두 벌로 갈라지지 않게).
function apiDevServer() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        const name = req.url.split('?')[0].slice('/api/'.length)
        if (!/^[a-z0-9-]+$/.test(name)) return next()

        server
          .ssrLoadModule(`/api/${name}.js`)
          .then((mod) => mod.default(req, res))
          .catch((e) => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: e.message }))
          })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // VITE_ 접두사가 없는 서버용 변수(GEMINI_API_KEY 등)도 개발 중 핸들러가 읽을 수 있게 한다.
  // 클라이언트 번들에는 들어가지 않는다 — 이 값들은 process.env로만 노출된다.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return { plugins: [react(), apiDevServer()] }
})
