// 진입점: 타이틀 화면 (판 선택·새로 시작·이어하기·장 선택·크레딧) → 판 dynamic import → 전투
// 개발·자동 테스트: ?ed=original|remake&stage=N&route=R 이면 타이틀을 건너뛰고 그 장을 바로 시작한다
// &party=0,18,27&items=1,2 를 붙이면 그 일행·소지품으로 캠페인처럼 시작 (정비 화면이 뜬다)
import { boot, checkEnd, chooseRoute } from './core/battle'
import { snapshot } from './core/campaign'
import type { Edition } from './core/edition'
import { reachable } from './core/grid'
import { applyFont } from './core/font'
import { bindInput } from './core/input'
import { resize, toScreen } from './core/render'
import { stageDef } from './core/stage'
import { S } from './core/state'
import { showTitle, type Launch } from './core/title'

const loadEdition = (id: string | null): Promise<Edition> =>
  (id === 'original' ? import('./editions/original') : import('./editions/remake')).then(m => m.edition)

async function main() {
  applyFont()
  const q = new URLSearchParams(location.search)
  const n = Number(q.get('stage'))
  const ids = (k: string) => (q.get(k) ?? '').split(',').filter(Boolean).map(Number)
  const go: Launch = n
    ? { ed: q.get('ed') === 'original' ? 'original' : 'remake', def: stageDef(n, Number(q.get('route') ?? 0)),
        camp: q.has('party') ? { flags: ['npc19'], party: ids('party'), items: ids('items') } : undefined }
    : await showTitle()
  const ed = await loadEdition(go.ed)
  S.ed = ed
  bindInput()
  addEventListener('resize', () => S.map && resize())
  // 개발 중 브라우저에서 상태 확인·자동 테스트용
  if (import.meta.env.DEV) Object.assign(window, { __game: { S, camp: snapshot, toScreen, reachable, planFor: ed.planFor, checkEnd, chooseRoute } })
  await boot(ed, go.def, go.camp ?? null, go.resume)
}

main().catch(err => {
  document.body.innerHTML = `<pre style="color:#f88;padding:20px">${err}\n\n자원이 없으면: .venv/bin/python -I tools/export_web.py</pre>`
})
