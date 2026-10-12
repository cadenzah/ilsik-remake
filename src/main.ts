// 진입점: 판 선택 (?ed=original | remake, 기본 개선판) → 전투 시작
import { boot, checkEnd } from './core/battle'
import type { Edition } from './core/edition'
import { reachable } from './core/grid'
import { bindInput } from './core/input'
import { resize, toScreen } from './core/render'
import { stage01, type StageDef } from './core/stage'
import { S } from './core/state'

// ?stage=N&route=R 로 다른 장 배치를 시험할 수 있다 (진행은 아직 1장 기준)
function pickStage(q: URLSearchParams): StageDef {
  const n = Number(q.get('stage'))
  if (!n || n === 1) return stage01
  return { n, title: `${n}장`, route: Number(q.get('route') ?? 0) }
}

const loadEdition = (id: string | null): Promise<Edition> =>
  (id === 'original' ? import('./editions/original') : import('./editions/remake')).then(m => m.edition)

async function main() {
  const q = new URLSearchParams(location.search)
  const ed = await loadEdition(q.get('ed'))
  S.ed = ed
  bindInput()
  addEventListener('resize', () => S.map && resize())
  // 개발 중 브라우저에서 상태 확인·자동 테스트용
  if (import.meta.env.DEV) Object.assign(window, { __game: { S, toScreen, reachable, planFor: ed.planFor, checkEnd } })
  await boot(ed, pickStage(q))
}

main().catch(err => {
  document.body.innerHTML = `<pre style="color:#f88;padding:20px">${err}\n\n자원이 없으면: .venv/bin/python -I tools/export_web.py</pre>`
})
