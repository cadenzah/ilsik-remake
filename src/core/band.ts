// 위·아래 띠 (ux-proposal.md 30). 원작 띠 = 가운데 크림색 제목 칸 + 양옆 장식.
// 원작판: 제목 칸에 장 제목만. 개선판: 제목 칸 왼쪽에 턴 패, 양옆 장식 위에 원작 글자 버튼,
//   버튼에 마우스를 올리면 제목 칸 글자가 그 버튼 설명으로 (정비 화면 도구설명 칸 방식). 자리가 모자라면 순위 낮은 버튼부터 숨기고 메뉴에서 쓴다.
//   아래 띠 왼쪽 = 가리킨 칸 지형 패. '뒤로' 는 맵·창 바깥을 누르면 된다 (input.ts)
// 현대식 화면 (view.modern): 창틀 대신 위 바 한 줄 = [턴 패][제목 (버튼 설명)] … [버튼들], 지형 패는 맵 아래 모서리에 떠 있게
import { cartouche, FRAME, hud, onLayout, TOP_BAR, view } from './screen'
import { button, esc, textWidth } from './ui'

export interface BandButton {
  id: string
  label: string
  desc: string
  side: 'left' | 'right'
  prio: number        // 0 = 늘 보임, 클수록 먼저 숨김
  on: () => void
}

let root: HTMLElement | null = null
let bar: HTMLElement, titleEl: HTMLElement, plate: HTMLElement | null = null, terrain: HTMLElement | null = null
let title = '', buttons: BandButton[] = [], els = new Map<string, HTMLButtonElement>()
const hiddenIds = new Set<string>()
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
  plate = terrain = null
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
      e.onmouseenter = e.onfocus = () => say(b.desc)
      e.onmouseleave = e.onblur = () => say()
      els.set(b.id, e)
      root.append(e)
    }
  }
  place()
}

/** 제목 칸 글자 (없으면 장 제목) */
function say(text?: string) {
  titleEl.textContent = text ?? title
  titleEl.classList.toggle('desc', !!text)
}

export function setTitle(t: string) { title = t; say() }

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
}

/** 현대식 위 바: 왼쪽부터 턴 패·제목, 오른쪽 끝부터 버튼 (자리가 모자라면 순위 낮은 것부터 메뉴로) */
function placeModern() {
  const by = (TOP_BAR - 25) / 2, PAD = 8
  Object.assign(bar.style, { left: '0px', top: '0px', width: `${view.w}px`, height: `${TOP_BAR}px` })
  hiddenIds.clear()
  const plateW = plate ? Math.max(56, textWidth(plate.textContent ?? '') + 18) : 0
  if (plate) Object.assign(plate.style, { left: `${PAD}px`, top: `${by}px`, width: `${plateW}px` })
  const titleX = PAD + (plate ? plateW + 10 : 0)
  // 버튼: 오른쪽 무리 (적은 순서대로 오른쪽 끝) 앞에 왼쪽 무리
  const order = [...buttons.filter(b => b.side === 'left'), ...buttons.filter(b => b.side === 'right')]
  const shown = [...order], width = (b: BandButton) => parseFloat(els.get(b.id)!.style.width)
  const total = () => shown.reduce((n, b) => n + width(b) + GAP, 0)
  while (shown.length && total() > view.w - PAD - titleX - 120) {
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
  Object.assign(titleEl.style, { left: `${titleX}px`, top: '0px', width: `${Math.max(0, x - titleX - 8)}px`, height: `${TOP_BAR}px` })
  for (const [id, e] of els) e.hidden = hiddenIds.has(id)
  const fy = view.h - 25 - PAD
  if (terrain) Object.assign(terrain.style, { left: `${PAD}px`, top: `${fy}px` })
}

onLayout(place)
