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

/** 브라우저 기본 동작 막기: 오른쪽 클릭 메뉴 (글 입력 칸 제외), 페이지 확대 (핀치·Ctrl+휠·Safari 제스처).
 *  전투 맵의 확대는 캔버스가 직접 처리하므로 (input.ts) 페이지 자체는 늘 1배 */
function lockPage() {
  addEventListener('contextmenu', e => { if (!(e.target as Element).closest?.('textarea, input')) e.preventDefault() })
  addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault() }, { passive: false })
  addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault() }, { passive: false })
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) addEventListener(g, e => e.preventDefault())
}

async function main() {
  lockPage()
  applyFont()
  const q = new URLSearchParams(location.search)
  const n = Number(q.get('stage'))
  const ids = (k: string) => (q.get(k) ?? '').split(',').filter(Boolean).map(Number)
  const go: Launch = n
    ? { ed: q.get('ed') === 'original' ? 'original' : 'remake', def: stageDef(n, Number(q.get('route') ?? 0)),
        camp: q.has('party') ? { flags: ['npc19'], party: ids('party'), items: ids('items') } : undefined }
    : await showTitle()
  const ed = await loadEdition(go.ed)
  if (ed.id === 'original') applyFont(true)   // 원작판은 설정과 상관없이 원작 글꼴
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
