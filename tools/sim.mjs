// 밸런스 시뮬레이터 실행기 (B1 제안 8). 웹 core 규칙·판 AI 를 node 에서 그대로 돌린다 — 본체는 tools/sim/run.ts
//   node tools/sim.mjs [--ed remake|original] [--route 0|1|2|all] [--seed N] [--pick level|front] [--book yes|no] [--turns N] [--retry N]
//   [--careful lead|all|none] [--push yes|no] [--dmg orig|floor:0.15|ratio:0.4] [--dmg-enemy 같은 꼴] [--seeds 1-8] [--growth no] [--tune '{"42":{"foeScale":0.85}}'] [--until 장] [--counter no|0.5] [--counter-decay 0.5] [--foe-hp 1.3] [--zoc no] [--lag no] [--bane no|0.15] [--par content/remake/par.json] [--mind charge|hold|pack] [--retreat no] [--backer 1] [--json]   — 옵션 뜻은 tools/sim/run.ts main, 결과 읽는 법은 .claude/docs/balance-proposal.md "시뮬레이터"
// vite 로 TypeScript·?raw·import.meta.glob 를 풀고, 자원은 public/assets 에서 읽는다 (fetch 흉내). 화면 모듈은 불러올 때만 쓰는 DOM 을 빈 객체로
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 불러올 때 document·window 를 건드리는 모듈 (screen.ts hud 등) 용: 무엇을 읽든 부르든 자기 자신을 돌려주는 빈 객체
const none = new Proxy(function () {}, {
  get: (_, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : none,
  apply: () => none, construct: () => none, set: () => true,
})
const store = new Map()
Object.assign(globalThis, {
  document: none, window: globalThis, Image: none, requestAnimationFrame: () => 0, getComputedStyle: none, matchMedia: none,
  localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  addEventListener: () => {}, removeEventListener: () => {},
})
globalThis.fetch = async url => {
  const file = path.join(root, 'public', String(url).replace(/^\//, ''))
  try {
    const text = await readFile(file, 'utf8')
    return { ok: true, json: async () => JSON.parse(text), text: async () => text }
  } catch { return { ok: false, json: async () => null, text: async () => '' } }
}

const server = await createServer({ root, logLevel: 'error', appType: 'custom', server: { middlewareMode: true, hmr: false, watch: null } })
try {
  const sim = await server.ssrLoadModule('/tools/sim/run.ts')
  await sim.main(process.argv.slice(2))
} finally {
  await server.close()
}
