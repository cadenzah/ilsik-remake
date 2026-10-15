// 미니맵 (개선판, ux-proposal.md 29). 맵 창 오른쪽 위 원작 comma 창 「지도」.
// 바탕 = 맵 타일을 칸마다 몇 픽셀로 줄인 그림 (장마다 한 번), 유닛 점 = 아군 파랑·적 빨강·중립(NPC) 초록 (진영 표시와 같은 색),
// 흰 사각형 = 지금 보는 범위. 클릭·끌기 = 그 자리로 화면 이동. 켬/끔은 localStorage 에 기억.
// 자리는 맵 창 네 모서리 중 하나: 지금 모서리가 유닛을 가리면 덜 가리는 모서리로 비킨다 (가려진 아군을 못 고르는 일 없게)
import { TH, TW } from './data'
import { clampCam, afterFrame, toScreen } from './render'
import { hud, mapRect, onLayout, view } from './screen'
import { winUrl } from './skin'
import { isNpc, S } from './state'

const KEY = 'eclipse.minimap'
const MAX = { w: 168, h: 120 }   // 그림 칸 최대
let el: HTMLElement | null = null
let cv: HTMLCanvasElement, cx: CanvasRenderingContext2D
let base: HTMLCanvasElement | null = null, baseMap: unknown = null
let k = 4   // 칸당 픽셀
let corner = 0   // 0 오른쪽 위 (기본), 1 왼쪽 위, 2 오른쪽 아래, 3 왼쪽 아래
let W = 0, H = 0, drag = false

export function minimapOn(): boolean {
  try { return localStorage.getItem(KEY) !== '0' } catch { return true }
}

export function setMinimap(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* 이번만 */ }
  if (el) el.hidden = !on
}

/** 장을 시작할 때 (개선판) */
export function initMinimap() {
  el?.remove()
  el = document.createElement('div')
  el.className = 'owin minimap'
  el.innerHTML = '<div class="t">지도</div><canvas></canvas>'
  cv = el.querySelector('canvas')!
  cx = cv.getContext('2d')!
  hud.append(el)
  base = null
  el.hidden = !minimapOn()
  corner = 0
  drag = false
  const go = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height
    const m = mapRect()
    S.cam.x = fx * S.map.w * TW - m.w / S.cam.scale / 2
    S.cam.y = fy * S.map.h * TH - m.h / S.cam.scale / 2
    clampCam()
  }
  cv.onpointerdown = e => { if (e.button !== 0) return; e.stopPropagation(); drag = true; cv.setPointerCapture(e.pointerId); go(e) }
  cv.onpointermove = e => { if (drag) go(e) }
  cv.onpointerup = e => { drag = false; cv.releasePointerCapture(e.pointerId) }
  el.oncontextmenu = e => e.preventDefault()
  place()
}

function place() {
  if (!el || !S.map) return
  k = Math.max(1, Math.min(6, Math.floor(Math.min(MAX.w / S.map.w, MAX.h / S.map.h))))
  const w = S.map.w * k, h = S.map.h * k
  cv.width = w; cv.height = h
  W = w + 16 + 6; H = h + 25 + 9 + 6
  Object.assign(el.style, { width: `${W}px`, height: `${H}px`, backgroundImage: `url(${winUrl('comma', W, H)})` })
  Object.assign(cv.style, { left: '11px', top: '28px', width: `${w}px`, height: `${h}px` })
  moveTo(corner)
  base = null
}
onLayout(place)

/** 모서리 자리 (현대식 화면은 아래 모서리에 지형 패·[뒤로] 가 떠 있어 그만큼 띄운다) */
function cornerBox(c: number) {
  const m = mapRect(), pad = 6, bottom = view.modern ? 36 : pad
  return { x: c % 2 ? m.x + pad : m.x + m.w - W - pad, y: c < 2 ? m.y + pad : m.y + m.h - H - bottom }
}
function moveTo(c: number) {
  corner = c
  const p = cornerBox(c)
  Object.assign(el!.style, { left: `${p.x}px`, top: `${p.y}px` })
}

/** 그 모서리에 두면 가리는 유닛 점수 (아군 일행 3, 고른 유닛 6, 적 2, NPC 1) */
function covered(c: number) {
  const p = cornerBox(c), cw = TW * S.cam.scale, ch = TH * S.cam.scale, md = S.mode
  const chosen = 'unit' in md ? md.unit : null
  let n = 0
  for (const u of S.units) {
    if (u.hp <= 0 || u.alpha <= 0) continue
    const { sx, sy } = toScreen(u.px, u.py)
    if (sx + cw <= p.x - 2 || sx >= p.x + W + 2 || sy + ch <= p.y - 2 || sy >= p.y + H + 2) continue
    n += u === chosen ? 6 : u.troop === 0 ? 3 : u.side === 'enemy' ? 2 : 1
  }
  return n
}

/** 지금 모서리가 유닛을 가리면 가장 덜 가리는 모서리로 (같으면 그대로 — 깜빡임 없게). 끄는 중엔 안 움직인다 */
function dodge() {
  if (drag || !W) return
  const now = covered(corner)
  if (!now) return
  let best = corner, score = now
  for (const c of [0, 1, 2, 3]) { const v = covered(c); if (v < score) { best = c; score = v } }
  if (best !== corner) moveTo(best)
}

/** 맵 타일을 칸마다 k×k 로 줄인 바탕 (부드럽게 줄여 평균 색) */
function background() {
  if (base && baseMap === S.map) return base
  baseMap = S.map
  base = document.createElement('canvas')
  base.width = S.map.w * k; base.height = S.map.h * k
  const b = base.getContext('2d')!
  b.imageSmoothingEnabled = true
  b.imageSmoothingQuality = 'high'
  const mp = S.map
  for (let y = 0; y < mp.h; y++)
    for (let x = 0; x < mp.w; x++) {
      const t = mp.tiles[y * mp.w + x]
      b.drawImage(S.atlas, (t % mp.atlasCols) * TW, Math.floor(t / mp.atlasCols) * TH, TW, TH, x * k, y * k, k, k)
    }
  return base
}

function draw() {
  if (!el || el.hidden || !S.map) return
  if (cv.width !== S.map.w * k) place()
  dodge()
  cx.imageSmoothingEnabled = false
  cx.drawImage(background(), 0, 0)
  cx.fillStyle = 'rgba(0,0,0,.25)'
  cx.fillRect(0, 0, cv.width, cv.height)
  const d = Math.max(2, k - 1)
  for (const u of S.units) {
    if (u.hp <= 0 || u.alpha <= 0) continue
    cx.fillStyle = isNpc(u) ? '#3ce060' : u.side === 'ally' ? '#4a7dff' : '#ff3a3a'
    cx.fillRect(Math.round(u.px * k + (k - d) / 2), Math.round(u.py * k + (k - d) / 2), d, d)
  }
  const m = mapRect()
  cx.strokeStyle = '#fff'
  cx.lineWidth = 1
  cx.strokeRect(Math.round(S.cam.x / TW * k) + 0.5, Math.round(S.cam.y / TH * k) + 0.5,
    Math.round(m.w / S.cam.scale / TW * k) - 1, Math.round(m.h / S.cam.scale / TH * k) - 1)
}
afterFrame.push(draw)

export function removeMinimap() { el?.remove(); el = null }
