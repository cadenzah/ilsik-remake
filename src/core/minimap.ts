// 미니맵 (개선판, ux-proposal.md 29). 맵 창 오른쪽 위 원작 comma 창 「지도」.
// 바탕 = 맵 타일을 칸마다 몇 픽셀로 줄인 그림 (장마다 한 번), 유닛 점 = 아군 파랑·적 빨강·중립(NPC) 초록 (진영 표시와 같은 색),
// 흰 사각형 = 지금 보는 범위. 클릭·끌기 = 그 자리로 화면 이동. 켬/끔은 localStorage 에 기억
import { TH, TW } from './data'
import { clampCam, afterFrame } from './render'
import { hud, mapRect, onLayout } from './screen'
import { winUrl } from './skin'
import { isNpc, S } from './state'

const KEY = 'eclipse.minimap'
const MAX = { w: 168, h: 120 }   // 그림 칸 최대
let el: HTMLElement | null = null
let cv: HTMLCanvasElement, cx: CanvasRenderingContext2D
let base: HTMLCanvasElement | null = null, baseMap: unknown = null
let k = 4   // 칸당 픽셀

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
  let drag = false
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
  const W = w + 16 + 6, H = h + 25 + 9 + 6
  const m = mapRect()
  Object.assign(el.style, { left: `${m.x + m.w - W - 6}px`, top: `${m.y + 6}px`, width: `${W}px`, height: `${H}px`, backgroundImage: `url(${winUrl('comma', W, H)})` })
  Object.assign(cv.style, { left: '11px', top: '28px', width: `${w}px`, height: `${h}px` })
  base = null
}
onLayout(place)

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
