// 위·아래 띠 (ux-proposal.md 30). 원작 띠 = 가운데 크림색 제목 칸 + 양옆 장식.
// 원작판: 제목 칸에 장 제목만. 개선판: 제목 칸 왼쪽에 턴 패, 양옆 장식 위에 원작 글자 버튼,
//   자리가 모자라면 순위 낮은 버튼부터 숨기고 메뉴에서 쓴다.
//   아래 띠 왼쪽 = 가리킨 칸 지형 패. '뒤로' 는 맵·창 바깥을 누르면 된다 (input.ts)
// 현대식 화면 (view.modern): 창틀 대신 위 바 한 줄 = [턴 패][제목] … [버튼들], 지형 패는 맵 아래 모서리에 떠 있게
import { cartouche, FRAME, hud, onLayout, TOP_BAR, view } from './screen'
import { button, esc, textWidth } from './ui'

export interface BandButton {
  id: string
  label: string
  side: 'left' | 'right'
  prio: number        // 0 = 늘 보임, 클수록 먼저 숨김
  on: () => void
}

let root: HTMLElement | null = null
let bar: HTMLElement, titleEl: HTMLElement, plate: HTMLElement | null = null, terrain: HTMLElement | null = null
let buttons: BandButton[] = [], els = new Map<string, HTMLButtonElement>()
const hiddenIds = new Set<string>()
let chips: { c: BandChip; el: HTMLButtonElement }[] = []   // 개선판 배지 (stageBadges.ts: 도전 과제·장 환경)
let talk: HTMLButtonElement | null = null, talkFn: (() => void) | null = null   // 대화 중에만 「대화 기록」 (두 판)
const BTN_Y = 14, GAP = 4, EDGE = 14

/** 띠를 만든다. remake = 개선판 (버튼·턴 패·지형 패) */
export function initBand(remake: boolean, btns: BandButton[] = []) {
  root?.remove()
  root = document.createElement('div')
  root.className = 'band'
  hud.append(root)
  bar = document.createElement('div')
  bar.className = 'band-bar'   // 현대식 위 바 바탕 (원작 화면에선 CSS 로 숨김)
  root.append(bar)
  titleEl = document.createElement('div')
  titleEl.className = 'band-title'
  root.append(titleEl)
  buttons = remake ? btns : []
  els = new Map()
  chips = []
  plate = terrain = null
  talk = button(['대화 기록', () => talkFn?.()])
  talk.classList.add('talklog-btn')
  talk.hidden = !talkFn
  root.append(talk)
  if (remake) {
    plate = document.createElement('div')
    plate.className = 'plate turn'
    root.append(plate)
    terrain = document.createElement('div')
    terrain.className = 'plate terrain'
    terrain.hidden = true
    root.append(terrain)
    for (const b of buttons) {
      const e = button([b.label, b.on])
      els.set(b.id, e)
      root.append(e)
    }
  }
  place()
}

/** 대화 중 「대화 기록」 버튼 (fn = 누르면 열 창, null = 숨김). 화면 쪽 조작이라 대화창이 아니라 띠에 둔다:
 *  창틀 화면 = 아래 띠 오른쪽 끝, 현대식 = 위 바 버튼들 왼쪽 */
export function showTalkLog(fn: (() => void) | null) {
  talkFn = fn
  if (!talk) return
  talk.hidden = !fn
  place()
}

export function setTitle(t: string) { titleEl.textContent = t; place() }

/** 띠 배지. 원작 창틀 화면 = 아래 띠 오른쪽 (대화 기록 자리 왼쪽), 현대식 = 위 바 턴 패 옆. w = 잴 수 없을 때의 너비, short = 현대식 위 바에서 제목이 안 들어갈 때 대신 보일 것 */
export interface BandChip { id: string; html: string; short?: string; w: number; label: string; on: () => void }
export function setChips(list: BandChip[]) {
  for (const { el } of chips) el.remove()
  chips = list.map(c => {
    const el = document.createElement('button')
    el.className = 'bchip'
    el.dataset.id = c.id
    el.innerHTML = c.html
    el.title = c.label
    el.setAttribute('aria-label', c.label)
    el.tabIndex = -1
    el.onclick = e => { e.stopPropagation(); c.on() }
    el.oncontextmenu = e => e.preventDefault()
    root?.append(el)
    return { c, el }
  })
  place()
}

/** 배지 하나의 모양: 넓게 (html) 또는 좁게 (short). 너비는 실제로 그려 잰다 (글꼴마다 글자 폭이 달라 어림하면 글이 테를 넘는다) */
const measured = new Map<string, number>()
function chipShape(ch: { c: BandChip; el: HTMLButtonElement }, wide: boolean) {
  const use = wide || !ch.c.short
  const html = use ? ch.c.html : ch.c.short!
  ch.el.innerHTML = html
  let w = measured.get(html)
  if (!w) {
    ch.el.style.width = 'auto'
    w = ch.el.offsetWidth ? Math.ceil(ch.el.offsetWidth) : use ? ch.c.w : 30
    if (ch.el.offsetWidth) measured.set(html, w)
  }
  ch.el.style.width = `${w}px`
  return w
}

/** 턴 패: "4턴" + 차례 (아군 파랑·적 빨강·NPC 초록). 적·NPC 차례엔 제목 칸이 붉은 빛 */
export function setTurn(turn: number, side: 'ally' | 'enemy' | 'npc' | null, who = '') {
  root?.classList.toggle('foe', side === 'enemy')
  if (!plate) return
  const label = side === 'ally' ? (who || '아군') : side === 'enemy' ? '적' : side === 'npc' ? 'NPC' : ''
  plate.innerHTML = `${turn}턴${label ? ` <b class="${side}">${esc(label)}</b>` : ''}`
  place()
}

/** 가리킨 칸 지형 (개선판 아래 띠) */
export function setTerrain(text: string | null) {
  if (!terrain) return
  terrain.hidden = !text
  terrain.textContent = text ?? ''
}

/** 켬/끔 버튼 표시 */
export function setOn(id: string, on: boolean) { els.get(id)?.classList.toggle('on', on) }
export function setDisabled(id: string, off: boolean) { const e = els.get(id); if (e) e.disabled = off }

/** 자리가 없어 숨긴 버튼 (메뉴에서 대신 보인다) */
export const bandHidden = (id: string) => hiddenIds.has(id)

function place() {
  if (!root) return
  if (view.modern) { placeModern(); return }
  const c = cartouche()
  Object.assign(titleEl.style, { left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px` })
  hiddenIds.clear()
  const width = (b: BandButton) => parseFloat(els.get(b.id)!.style.width)
  // 왼쪽: 턴 패가 제목 칸에 붙고, 그 바깥으로 버튼
  const plateW = plate ? Math.max(56, textWidth(plate.textContent ?? '') + 18) : 0
  if (plate) Object.assign(plate.style, { left: `${c.x - 6 - plateW}px`, top: `${BTN_Y}px`, width: `${plateW}px` })
  const fit = (side: 'left' | 'right', avail: number) => {
    const list = buttons.filter(b => b.side === side)
    const shown = [...list]
    const total = () => shown.reduce((n, b) => n + width(b) + GAP, 0)
    while (shown.length && total() > avail) {
      const worst = shown.reduce((a, b) => (b.prio > a.prio ? b : a))
      if (worst.prio === 0) break
      shown.splice(shown.indexOf(worst), 1)
      hiddenIds.add(worst.id)
    }
    return list.filter(b => shown.includes(b))
  }
  const leftEnd = c.x - 6 - (plate ? plateW + GAP : 0)
  let x = leftEnd
  for (const b of fit('left', leftEnd - EDGE)) {   // 제목 칸 쪽에서 바깥으로
    x -= width(b)
    Object.assign(els.get(b.id)!.style, { left: `${x}px`, top: `${BTN_Y}px` })
    x -= GAP
  }
  x = c.x + c.w + 6
  for (const b of fit('right', view.w - EDGE - x)) {
    Object.assign(els.get(b.id)!.style, { left: `${x}px`, top: `${BTN_Y}px` })
    x += width(b) + GAP
  }
  for (const [id, e] of els) e.hidden = hiddenIds.has(id)
  const by = view.h - FRAME.b + 7
  if (terrain) Object.assign(terrain.style, { left: `${EDGE + 54}px`, top: `${by}px` })
  if (talk) Object.assign(talk.style, { left: `${view.w - EDGE - 54 - parseFloat(talk.style.width)}px`, top: `${by}px` })   // 지형 패와 맞선 자리
  // 배지: 아래 띠, 「대화 기록」 자리 왼쪽부터 안쪽으로 (위 제목 칸은 가장 좁은 화면에서 긴 장 제목만으로 거의 차서 겹치거나 잘린다 — 22장 · 신카루스 항구 안 = 192 / 266)
  let rx = view.w - EDGE - 54 - (talk ? parseFloat(talk.style.width) + 8 : 0)
  for (const ch of [...chips].reverse()) {
    rx -= chipShape(ch, true)
    Object.assign(ch.el.style, { left: `${rx}px`, top: `${by + 1}px` })
    rx -= 6
  }
}

/** 현대식 위 바: 왼쪽부터 턴 패·제목, 오른쪽 끝부터 버튼 (자리가 모자라면 순위 낮은 것부터 메뉴로) */
function placeModern() {
  // 배지를 넓게 / 좁게 둘 다 놓아 보고 숨는 버튼이 적은 쪽 (같으면 넓게). 제목이 안 들어가면 좁게
  const short = chips.some(ch => ch.c.short) ? layoutModern(false) : null
  const wide = layoutModern(true)
  if (short && (!wide.fits && short.fits || short.hidden < wide.hidden)) layoutModern(false)
}
function layoutModern(wide: boolean): { hidden: number; fits: boolean } {
  const by = (TOP_BAR - 25) / 2, PAD = 8
  Object.assign(bar.style, { left: '0px', top: '0px', width: `${view.w}px`, height: `${TOP_BAR}px` })
  hiddenIds.clear()
  const plateW = plate ? Math.max(56, textWidth(plate.textContent ?? '') + 18) : 0
  if (plate) Object.assign(plate.style, { left: `${PAD}px`, top: `${by}px`, width: `${plateW}px` })
  let titleX = PAD + (plate ? plateW + 10 : 0)
  for (const ch of chips) {   // 배지: 턴 패 바로 옆
    const w = chipShape(ch, wide)
    Object.assign(ch.el.style, { left: `${titleX}px`, top: `${(TOP_BAR - 22) / 2}px` })
    titleX += w + 6
  }
  if (chips.length) titleX += 4
  // 버튼: 오른쪽 무리 (적은 순서대로 오른쪽 끝) 앞에 왼쪽 무리
  const order = [...buttons.filter(b => b.side === 'left'), ...buttons.filter(b => b.side === 'right')]
  const shown = [...order], width = (b: BandButton) => parseFloat(els.get(b.id)!.style.width)
  const talkW = talk && !talk.hidden ? parseFloat(talk.style.width) + GAP : 0   // 대화 중 「대화 기록」 도 위 바 자리를 쓴다
  const total = () => shown.reduce((n, b) => n + width(b) + GAP, talkW)
  const tw = Math.max(120, textWidth(titleEl.textContent ?? '') + 8)   // 제목 몫: 실제 글 길이 (전에는 120 고정이라 좁은 화면에서 긴 장 제목이 잘렸다)
  while (shown.length && total() > view.w - PAD - titleX - tw) {
    const worst = shown.reduce((a, b) => (b.prio > a.prio ? b : a))
    if (worst.prio === 0) break
    shown.splice(shown.indexOf(worst), 1)
    hiddenIds.add(worst.id)
  }
  let x = view.w - PAD
  for (const b of [...shown].reverse()) {
    x -= width(b)
    Object.assign(els.get(b.id)!.style, { left: `${x}px`, top: `${by}px` })
    x -= GAP
  }
  if (talk && !talk.hidden) {
    x -= parseFloat(talk.style.width)
    Object.assign(talk.style, { left: `${x}px`, top: `${by}px` })
    x -= GAP
  }
  const fits = x - titleX >= tw
  Object.assign(titleEl.style, { left: `${titleX}px`, top: '0px', width: `${Math.max(0, x - titleX - 8)}px`, height: `${TOP_BAR}px` })
  for (const [id, e] of els) e.hidden = hiddenIds.has(id)
  const fy = view.h - 25 - PAD
  if (terrain) Object.assign(terrain.style, { left: `${PAD}px`, top: `${fy}px` })
  return { hidden: hiddenIds.size, fits }
}

onLayout(place)
