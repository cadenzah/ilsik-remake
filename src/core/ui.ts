// 원작 창 (comma 창틀: 주황 제목 띠 + 크림 바탕, ECPBUT 글자 버튼) — 명령창·확인창·결과·선택 팝업을 모두 이것으로 (ux-proposal.md 2·6·22·24).
// 창은 #hud (논리 좌표) 안 DOM. 원작처럼 모달: 창이 떠 있으면 맵 클릭은 무시하고, 오른쪽 클릭·Esc 는 맨 위 창의 '뒤로'.
// 원작 치수 (DOSBox u30): 제목 띠 25, 아래 9, 옆 8, 버튼 25 높이·4 간격, 첫 버튼은 바탕 5 아래, 명령창 버튼 64 폭·창 86
import { hud, mapRect, clampBox, onLayout } from './screen'
import { buttonUrl, winUrl } from './skin'

export type Btn = [string, () => void] | [string, () => void, { disabled?: boolean; title?: string }]

interface Win { el: HTMLElement; onBack?: () => void; modal: boolean; kind: string; dim: boolean; keys?: (e: KeyboardEvent) => boolean }
const stack: Win[] = []
const changeFns: (() => void)[] = []
let outsideCloses = () => false
/** 창 바깥을 누르면 '뒤로' 인가 (개선판 전투 = input.ts). 그런 창에는 ✕ 를 달지 않는다 (2026-11-06) */
export const setOutsideCloses = (f: () => boolean) => { outsideCloses = f }
/** 창이 열리고 닫힐 때마다 (띠 「메뉴」 눌린 표시 등) */
export const onWinChange = (f: () => void) => { changeFns.push(f) }

export const BAR = 25, BOTTOM = 9, SIDE = 8, BTN_H = 25, GAP = 4
const CH = 16   // 글자 폭 (원작 글꼴 한글 16)

/** 버튼 그림을 CSS 변수로 (skin 을 읽은 뒤 한 번) */
export function initSkinCss() {
  const r = document.documentElement.style
  r.setProperty('--btn', `url(${buttonUrl(56)})`)
  r.setProperty('--btn-down', `url(${buttonUrl(56, true)})`)
}

export const textWidth = (s: string) => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 0x7f ? CH : CH / 2), 0)
export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** 원작 글자 버튼 */
export function button([label, fn, opt]: Btn, w?: number): HTMLButtonElement {
  const b = document.createElement('button')
  b.className = 'obtn'
  b.textContent = label
  b.style.width = `${w ?? Math.max(56, textWidth(label) + 16)}px`
  if (opt?.title) b.title = opt.title
  if (opt?.disabled) b.disabled = true
  b.onclick = e => { e.stopPropagation(); fn() }
  b.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); back() }
  return b
}

export interface WinOpts {
  title?: string
  buttons?: Btn[]
  dir?: 'col' | 'row'
  body?: string          // 버튼 위 본문 (HTML, 원작 글자 색 클래스 .blue .red .dim)
  bodyH?: number         // 본문 높이 (없으면 줄 수 × 16 + 여백)
  fit?: boolean          // 본문 높이를 실제로 그려 재서 맞춘다 (목록·문단처럼 <br> 줄 수로 못 재는 글)
  width?: number         // 창 너비 (없으면 버튼·본문에 맞춤)
  btnW?: number          // 버튼 너비 (없으면 가장 긴 글자에 맞춤)
  at?: { x: number; y: number } | 'center'
  onBack?: () => void    // 오른쪽 클릭·Esc. 없으면 무시 (원작 모달)
  modal?: boolean        // 기본 true
  kind?: string          // 같은 kind 창은 하나만 (다시 열면 바꿈)
  closeOnPick?: boolean  // 버튼을 누르면 창을 닫고 동작 (기본 true)
  x?: boolean            // 제목 줄 오른쪽 ✕ (= onBack, 터치 기기용). 기본: 제목과 onBack 이 있고, 바깥 누르기로 닫을 수 없는 창 (원작판 전투의 덮개 없는 창)
  dim?: boolean          // 맵을 어둡게 덮고 누르면 onBack. 기본: 가운데 창이고 onBack 이 있으면
}

/** comma 창을 연다. 돌려준 요소에 더 붙일 수 있다 */
export function openWin(o: WinOpts): HTMLElement {
  if (o.kind) closeWin(o.kind)
  const btns = o.buttons ?? []
  const dir = o.dir ?? 'col'
  const bw = o.btnW ?? Math.max(dir === 'col' ? 64 : 54, ...btns.map(b => textWidth(b[0]) + 16))
  const rowW = btns.length * bw + (btns.length - 1) * GAP
  const minW = btns.length ? (dir === 'col' ? bw + 22 : rowW + 26) : 0
  const w = Math.round(Math.max(minW, o.width ?? Math.max(o.title ? textWidth(o.title) + 40 : 0, o.body ? 136 : 0, 86)))
  // 본문 줄 수: <br> 줄마다 창 안쪽 너비로 접힌 줄 수
  const lines = o.body ? o.body.split('<br>').reduce((n, l) => n + Math.max(1, Math.ceil(textWidth(l.replace(/<[^>]+>/g, '').replace(/&\w+;/g, '_')) / (w - 24))), 0) : 0
  const want = o.body ? (o.bodyH ?? (o.fit ? measureBody(o.body, w, o.kind) : lines * 18) + 8) : 0
  const btnBlock = !btns.length ? 0 : dir === 'col' ? btns.length * (BTN_H + GAP) - GAP : BTN_H
  const frame = BAR + 5 + (btns.length ? btnBlock + (o.body ? 4 : 2) : 0) + 5 + BOTTOM
  // 맵 칸보다 길면 본문만 줄이고 스크롤 (버튼은 늘 보이게)
  const room = mapRect().h - 8 - frame
  const bodyH = want > room ? Math.max(36, room) : want
  const h = frame + bodyH
  const el = document.createElement('div')
  el.className = `owin ${o.kind ?? ''}`
  el.style.width = `${w}px`
  el.style.height = `${h}px`
  el.style.backgroundImage = `url(${winUrl('comma', w, h)})`
  if (o.title) el.insertAdjacentHTML('beforeend', `<div class="t">${esc(o.title)}</div>`)
  if (o.body) el.insertAdjacentHTML('beforeend', `<div class="b${bodyH < want ? ' scroll' : ''}" style="top:${BAR + 5}px;height:${bodyH}px">${o.body}</div>`)
  const pick = o.closeOnPick ?? true
  btns.forEach((b, i) => {
    const fn = b[1]
    const e = button([b[0], () => { if (pick) close(); fn() }, b[2] as never], bw)
    if (dir === 'col') Object.assign(e.style, { left: `${Math.round((w - bw) / 2)}px`, top: `${BAR + 5 + bodyH + i * (BTN_H + GAP)}px` })
    else Object.assign(e.style, { left: `${Math.round((w - rowW) / 2) + i * (bw + GAP)}px`, top: `${BAR + 5 + bodyH + (o.body ? 4 : 2)}px` })
    el.append(e)
  })
  const m = mapRect()
  const at = o.at === 'center' || !o.at ? { x: m.x + (m.w - w) / 2, y: m.y + (m.h - h) / 2 } : o.at
  const p = clampBox(at.x, at.y, w, h)
  el.style.left = `${p.x}px`
  el.style.top = `${p.y}px`
  if (o.at === 'center' || !o.at) el.dataset.at = 'center'
  hud.append(el)
  const win: Win = { el, onBack: o.onBack, modal: o.modal ?? true, kind: o.kind ?? '', dim: !!o.onBack && (o.dim ?? o.at === 'center') }
  if (o.onBack && (o.x ?? (!!o.title && !win.dim && !outsideCloses()))) {
    const x = document.createElement('button')
    x.className = 'oclose'
    x.innerHTML = '<i></i>'   // i = 작은 판, 그 위 ✕ 두 획 (style.css)
    x.setAttribute('aria-label', '닫기')
    x.tabIndex = -1
    x.onclick = e => { e.stopPropagation(); win.onBack?.() }
    el.append(x)
    el.classList.add('hasx')   // 제목은 ✕ 를 뺀 자리 가운데 (원작 창 크기는 그대로)
  }
  stack.push(win)
  const close = () => closeEl(el)
  el.querySelector<HTMLButtonElement>('.obtn:not(:disabled)')?.focus({ preventScroll: true })
  el.oncontextmenu = e => { e.preventDefault(); back() }
  changed()
  return el
}

/** 본문을 보이지 않게 실제 창 모양으로 그려 높이를 잰다 (fit) */
function measureBody(body: string, w: number, kind?: string) {
  const probe = document.createElement('div')
  probe.className = `owin ${kind ?? ''}`
  Object.assign(probe.style, { width: `${w}px`, height: '0', visibility: 'hidden', left: '-9999px', top: '0' })
  probe.innerHTML = `<div class="b" style="top:0">${body}</div>`
  hud.append(probe)
  const h = probe.querySelector<HTMLElement>('.b')!.scrollHeight
  probe.remove()
  return h
}

function closeEl(el: HTMLElement) {
  const i = stack.findIndex(w => w.el === el)
  if (i >= 0) stack.splice(i, 1)
  el.remove()
  changed()
}

// 맵 덮개: 어둡게 하는 창이 하나라도 있으면 맨 위 창 바로 밑에 깔고, 누르면 맨 위 창의 '뒤로' (창 바깥 = 닫기를 보이게).
// 맵 칸만 덮어 띠 버튼 (「메뉴」 다시 누르기) 은 그대로 쓴다
let shade: HTMLElement | null = null
function changed() {
  const top = [...stack].reverse().find(w => w.modal)
  if (top && stack.some(w => w.dim && w.modal)) {
    if (!shade) {
      shade = document.createElement('div')
      shade.className = 'oshade'
      shade.onclick = e => { e.stopPropagation(); back() }
      shade.oncontextmenu = e => { e.preventDefault(); back() }
    }
    placeShade()
    if (shade.nextSibling !== top.el) hud.insertBefore(shade, top.el)
  } else shade?.remove()
  for (const f of changeFns) f()
}
function placeShade() {
  if (!shade) return
  const m = mapRect()
  Object.assign(shade.style, { left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px` })
}
onLayout(placeShade)

/** 화면 배치가 바뀌면 (개선된 UI 켜고 끄기·창 크기) 떠 있는 창을 지금 맵 창에 다시 둔다: 가운데 창은 가운데로, 나머지는 맵 창 안으로 밀어 넣는다.
 *  창·인물기본자료 (.owin) 와 큰 상태창 (.bigstat, camp.ts statusWindow) */
function placeFloating() {
  const m = mapRect()
  for (const el of hud.querySelectorAll<HTMLElement>(':scope > .owin, :scope > .bigstat')) {
    const w = el.offsetWidth, h = el.offsetHeight
    const p = el.dataset.at === 'center'
      ? { x: Math.round(m.x + (m.w - w) / 2), y: Math.round(m.y + Math.max(0, (m.h - h) / 2)) }
      : clampBox(parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0, w, h)
    el.style.left = `${p.x}px`
    el.style.top = `${p.y}px`
  }
}
onLayout(placeFloating)

/** kind 창 (없으면 맨 위 창) 을 닫는다 */
export function closeWin(kind?: string) {
  for (const w of [...stack].reverse()) if (kind === undefined || w.kind === kind) { closeEl(w.el); if (kind === undefined) return }
}
export const closeAll = () => { while (stack.length) closeEl(stack[stack.length - 1].el) }

/** 모달 창이 떠 있나 (맵 클릭 막기) */
export const modalOpen = () => stack.some(w => w.modal)
export const isOpen = (kind: string) => stack.some(w => w.kind === kind)
/** 모달이 아닌 창 (도전 과제·장 환경 배지 창) 까지 하나라도 떠 있나 */
export const anyWinOpen = () => stack.length > 0

/** 오른쪽 클릭·Esc: 맨 위 모달 창의 '뒤로'. 창이 처리했으면 true */
export function back(): boolean {
  const top = [...stack].reverse().find(w => w.modal)
  if (!top) return false
  top.onBack?.()
  return true
}

/** Enter: 맨 위 모달 창의 초점 버튼 (없으면 첫 버튼) */
export function enter(): boolean {
  const top = [...stack].reverse().find(w => w.modal)
  if (!top) return false
  const b = (top.el.contains(document.activeElement) ? document.activeElement : top.el.querySelector('.obtn:not(:disabled)')) as HTMLButtonElement | null
  b?.click()
  return true
}

// ---------- 자주 쓰는 창 ----------

/** 명령창 (원작: 누른 유닛 오른쪽 옆, 제목 '명령') */
export function showMenu(items: Btn[], x: number, y: number, title = '명령', onBack?: () => void, more?: Partial<WinOpts>) {
  openWin({ title, buttons: items, at: { x, y }, kind: 'menu', onBack: onBack ?? (() => closeWin('menu')), ...more })
}
export const hideMenu = () => closeWin('menu')

/** 확인창 (원작 「전 투」「휴식」「대기화면」: 136×66, 결정·취소). body = 개선판 예측 줄 */
export function confirmWin(title: string, at: { x: number; y: number } | 'center', ok: () => void, cancel: () => void = () => {}, body?: string, width?: number) {
  openWin({ title, at, kind: 'confirm', dir: 'row', btnW: 54, body, width: width ?? (body ? 168 : 136),
    buttons: [['결정', ok], ['취소', cancel]], onBack: () => { closeWin('confirm'); cancel() }, x: false })
}

/** 결과·선택 팝업 (맵 창 가운데). 버튼을 누르면 닫고 그 동작 */
export function showResult(title: string, body: string, buttons: Btn[], note = '') {
  const text = [body, note].filter(Boolean).map(t => esc(t).replace(/\n/g, '<br>')).join('<br>')
  const longest = Math.max(...buttons.map(b => textWidth(b[0])))
  const row = buttons.length <= 3 && buttons.length * (longest + 20) < mapRect().w - 60
  openWin({ title, body: text || undefined, buttons, dir: row ? 'row' : 'col', at: 'center', kind: 'result',
    width: Math.min(mapRect().w - 16, Math.max(180, ...text.split('<br>').map(l => textWidth(l) + 32))) })
}
