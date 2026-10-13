// 전투 화면 틀: 논리 화면 크기와 확대, 원작 전투 창틀 (ECPMAI "mapwin"), DOM 층 #hud (ux-proposal.md 1·27).
// 배율 s = min(창 너비/640, 창 높이/480) ("딱 맞춤"). 원작판 = 640×480 고정 (남는 곳 검은 띠),
// 개선판 = 논리 화면을 창 비율대로 늘려 꽉 채운다 (가로로 늘면 위·아래 띠, 세로로 늘면 기둥을 skin.strip 으로 늘림).
// 캔버스(#view)는 창 전체 장치 픽셀, #hud 는 논리 크기 div 를 s 배로 확대해 창·버튼을 논리 좌표에 둔다.
import { nine } from './skin'

export const FRAME = { l: 68, t: 57, r: 68, b: 39 }   // 창틀 두께 (모서리 조각 크기)
export const view = { s: 1, ox: 0, oy: 0, w: 640, h: 480, wide: false }

export const hud = document.getElementById('hud') as HTMLElement

/** 맵 창 (논리 좌표) */
export const mapRect = () => ({ x: FRAME.l, y: FRAME.t, w: view.w - FRAME.l - FRAME.r, h: view.h - FRAME.t - FRAME.b })

/** 위 띠 가운데 크림색 제목 칸 (mw.1 안 x 119~384, y 12~40). 띠는 양쪽 구간을 반씩 늘리므로 왼쪽에 ceil(늘린 길이/2) 만큼 밀린다 */
export const cartouche = () => ({ x: FRAME.l + 119 + Math.ceil((view.w - 640) / 2), y: 12, w: 266, h: 29 })

const listeners: (() => void)[] = []
export const onLayout = (f: () => void) => { listeners.push(f) }

let frameCanvas: HTMLCanvasElement | null = null
/** 창틀 그림 (논리 크기). 크기가 바뀔 때만 새로 */
export function frameImage(): HTMLCanvasElement {
  if (!frameCanvas || frameCanvas.width !== view.w || frameCanvas.height !== view.h) {
    frameCanvas = document.createElement('canvas')
    frameCanvas.width = view.w
    frameCanvas.height = view.h
    nine(frameCanvas.getContext('2d')!, 'mw', 0, 0, view.w, view.h)
  }
  return frameCanvas
}

/** 창 크기에 맞춰 논리 화면을 다시 잡는다 */
export function layout(wide = view.wide) {
  view.wide = wide
  const iw = innerWidth, ih = innerHeight
  const s = Math.min(iw / 640, ih / 480)
  view.s = s
  view.w = wide ? Math.max(640, Math.floor(iw / s)) : 640
  view.h = wide ? Math.max(480, Math.floor(ih / s)) : 480
  view.ox = Math.round((iw - view.w * s) / 2)
  view.oy = Math.round((ih - view.h * s) / 2)
  Object.assign(hud.style, { left: `${view.ox}px`, top: `${view.oy}px`, width: `${view.w}px`, height: `${view.h}px`, transform: `scale(${s})` })
  for (const f of listeners) f()
}

/** 창(클라이언트) 좌표 → 논리 좌표 */
export const toLogical = (cx: number, cy: number) => ({ x: (cx - view.ox) / view.s, y: (cy - view.oy) / view.s })

/** 논리 좌표의 상자를 맵 창 안에 들게 옮긴 왼쪽 위 */
export function clampBox(x: number, y: number, w: number, h: number, pad = 4) {
  const m = mapRect()
  return {
    x: Math.round(Math.max(m.x + pad, Math.min(m.x + m.w - w - pad, x))),
    y: Math.round(Math.max(m.y + pad, Math.min(m.y + m.h - h - pad, y))),
  }
}
