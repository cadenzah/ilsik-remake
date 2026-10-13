// 원작 UI 그림 조각 (public/assets/ui/battle-ui.png + .json, tools/export_web.py export_battle_ui).
// FRTWND 9조각 창 (이름.0 바탕 .1 위 .2 왼위 .3 오른위 .4 왼아래 .5 오른아래 .6 아래 .7 왼쪽 .8 오른쪽) 을 원하는 크기로 이어 붙인다.
// 장식이 있는 긴 변(전투 창틀 띠·기둥, 대화창 테두리)은 무늬가 이어지는 구간을 되풀이해 늘린다 (ux-proposal.md 27·31).
import { A, loadImage } from './data'

type Rect = [number, number, number, number]
let sheet: HTMLImageElement | null = null
let rects: Record<string, Rect> = {}

export async function loadSkin() {
  if (sheet) return
  const [img, r] = await Promise.all([loadImage(`${A}/ui/battle-ui.png`), fetch(`${A}/ui/battle-ui.json`).then(r => r.json() as Promise<Record<string, Rect>>)])
  sheet = img
  rects = r
}

export const size = (name: string) => { const r = rects[name]; return r ? { w: r[2], h: r[3] } : { w: 0, h: 0 } }

/** 조각 하나. w·h 를 주면 늘려 그린다 */
export function piece(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w?: number, h?: number) {
  const r = rects[name]
  if (!r || !sheet) return
  ctx.drawImage(sheet, r[0], r[1], r[2], r[3], x, y, w ?? r[2], h ?? r[3])
}

/** 조각의 일부 (조각 안 좌표) */
function part(ctx: CanvasRenderingContext2D, name: string, sx: number, sy: number, sw: number, sh: number, x: number, y: number) {
  const r = rects[name]
  if (!r || !sheet || sw <= 0 || sh <= 0) return
  ctx.drawImage(sheet, r[0] + sx, r[1] + sy, sw, sh, x, y, sw, sh)
}

/** 조각을 영역에 바둑판처럼 깐다 (끝은 잘림) */
export function tile(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number) {
  const { w: pw, h: ph } = size(name)
  if (!pw || !ph) return
  for (let yy = 0; yy < h; yy += ph)
    for (let xx = 0; xx < w; xx += pw) part(ctx, name, 0, 0, Math.min(pw, w - xx), Math.min(ph, h - yy), x + xx, y + yy)
}

/** 되풀이 구간: 조각을 늘릴 때 [a, b) 를 반복한다. 둘이면 양쪽에 반씩 (가운데 장식 유지) */
const SEGMENTS: Record<string, [number, number][]> = {
  'mw.1': [[4, 52], [451, 498]],   // 전투 창틀 위 띠: 제목 칸 바깥 양쪽
  'mw.6': [[216, 287]],            // 아래 띠
  'mw.7': [[219, 269]],            // 왼쪽 여신 기둥 옷자락
  'mw.8': [[281, 322]],            // 오른쪽 악마 기둥 불꽃
  'speak.1': [[63, 71], [269, 277]], 'speak.6': [[63, 71], [269, 277]],   // 대화창 위·아래 (8픽셀 주기, 가운데 장식 유지)
  'speak.7': [[20, 32]], 'speak.8': [[20, 32]],
  'basic.1': [[7, 15], [129, 137]], 'basic.6': [[7, 15]],   // 인물기본자료 제목 띠 양옆 (8픽셀 주기, 제목 글자 유지)
}

/** 긴 조각을 len 으로 늘리거나 줄인다. horizontal = 가로 변. 구간이 없으면 바둑판 */
export function strip(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, len: number, horizontal: boolean) {
  const { w, h } = size(name)
  const full = horizontal ? w : h, segs = SEGMENTS[name]
  const put = (from: number, n: number, at: number) =>
    horizontal ? part(ctx, name, from, 0, n, h, x + at, y) : part(ctx, name, 0, from, w, n, x, y + at)
  if (!segs) { horizontal ? tile(ctx, name, x, y, len, h) : tile(ctx, name, x, y, w, len); return }
  if (len <= full) {   // 줄이기: 양끝을 남기고 가운데를 덜어 낸다
    const a = Math.ceil(len / 2)
    put(0, a, 0)
    put(full - (len - a), len - a, a)
    return
  }
  // 늘리기: 구간마다 (더할 길이 / 구간 수) 만큼 그 구간을 되풀이
  const extra = len - full
  const adds = segs.map((_, i) => Math.floor(extra / segs.length) + (i < extra % segs.length ? 1 : 0))
  let src = 0, at = 0
  segs.forEach(([a, b], i) => {
    put(src, b - src, at); at += b - src; src = b
    for (let left = adds[i]; left > 0;) {
      const n = Math.min(b - a, left)
      put(a, n, at); at += n; left -= n
    }
  })
  put(src, full - src, at)
}

/** 9조각 창. 위·아래 변 높이 = 모서리 높이, 왼·오른 변 너비 = 모서리 너비 */
export function nine(ctx: CanvasRenderingContext2D, pre: string, x: number, y: number, w: number, h: number) {
  const tl = size(`${pre}.2`), tr = size(`${pre}.3`), bl = size(`${pre}.4`), br = size(`${pre}.5`)
  tile(ctx, `${pre}.0`, x + tl.w, y + tl.h, w - tl.w - tr.w, h - tl.h - bl.h)
  strip(ctx, `${pre}.1`, x + tl.w, y, w - tl.w - tr.w, true)
  strip(ctx, `${pre}.6`, x + bl.w, y + h - bl.h, w - bl.w - br.w, true)
  strip(ctx, `${pre}.7`, x, y + tl.h, h - tl.h - bl.h, false)
  strip(ctx, `${pre}.8`, x + w - size(`${pre}.8`).w, y + tr.h, h - tr.h - br.h, false)
  piece(ctx, `${pre}.2`, x, y)
  piece(ctx, `${pre}.3`, x + w - tr.w, y)
  piece(ctx, `${pre}.4`, x, y + h - bl.h)
  piece(ctx, `${pre}.5`, x + w - br.w, y + h - br.h)
}

const urls = new Map<string, string>()
function cached(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  let u = urls.get(key)
  if (!u) {
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w))
    c.height = Math.max(1, Math.round(h))
    draw(c.getContext('2d')!)
    u = c.toDataURL()
    urls.set(key, u)
  }
  return u
}

/** 9조각 창 바탕 그림 (DOM 배경용, 논리 픽셀 크기) */
export const winUrl = (pre: string, w: number, h: number) => cached(`${pre}:${w}x${h}`, w, h, ctx => nine(ctx, pre, 0, 0, w, h))

/** 원작 글자 버튼 (ECPBUT 0005: 왼 8 + 가운데 + 오른 8, 높이 25). pressed = 눌림 그림 */
export const buttonUrl = (w: number, pressed = false) => cached(`btn:${w}:${pressed}`, w, 25, ctx => {
  const o = pressed ? 3 : 0
  piece(ctx, `btn.${o}`, 0, 0)
  tile(ctx, `btn.${o + 2}`, 8, 0, w - 16, 25)
  piece(ctx, `btn.${o + 1}`, w - 8, 0)
})

/** 조각 하나를 그림 주소로 (커서·아이콘) */
export const pieceUrl = (name: string) => { const { w, h } = size(name); return cached(`p:${name}`, w, h, ctx => piece(ctx, name, 0, 0)) }
