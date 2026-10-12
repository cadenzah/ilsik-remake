// 원작 비트맵 글꼴 FULLSOFT.FNT (formats.md "FULLSOFT.FNT 글꼴"): 한글 16×15 · 영문 8×15, 자간 0, (x,y) = 글리프 왼쪽 위.
// 원작 글자 = 그림자 색으로 x 에 한 번, 글자 색으로 x+1 에 한 번 (3cd3:a752 호출부). 원작판 화면에서만 쓴다
import { A, loadImage } from './data'

interface FontData { h: number; glyphs: Record<string, [number, number, number]> }

// EGA 표준색 (WIN 2 팔레트 0~15)
export const EGA = { 0: '#000000', 1: '#0000aa', 4: '#aa0000', 7: '#aaaaaa', 9: '#5555ff', 12: '#ff5555' } as const
export type Ink = [shadow: string, fg: string]
export const INK: Record<'normal' | 'blue' | 'red', Ink> = {
  normal: [EGA[7], EGA[0]], blue: [EGA[9], EGA[1]], red: [EGA[12], EGA[4]],
}

let font: Promise<{ data: FontData; tinted: Map<string, HTMLCanvasElement> }> | null = null

/** 글꼴을 한 번만 불러온다 */
export function loadFont() {
  font ??= Promise.all([fetch(`${A}/ui/font.json`).then(r => r.json() as Promise<FontData>), loadImage(`${A}/ui/font.png`)])
    .then(([data, img]) => {
      const tinted = new Map<string, HTMLCanvasElement>()
      for (const color of new Set(Object.values(EGA))) {   // 흰 아틀라스를 색마다 칠해 둔다
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const g = c.getContext('2d')!
        g.drawImage(img, 0, 0)
        g.globalCompositeOperation = 'source-in'
        g.fillStyle = color
        g.fillRect(0, 0, c.width, c.height)
        tinted.set(color, c)
      }
      return { data, tinted }
    })
  return font
}

const advance = (data: FontData, ch: string) => data.glyphs[ch]?.[2] ?? (ch.charCodeAt(0) < 0x80 ? 8 : 16)

/** 글자를 그린 캔버스 (너비 = 글자 폭 + 그림자 1px, 높이 15). 원작에 없는 글자는 칸만 비운다 */
export async function textCanvas(text: string, ink: Ink = INK.normal) {
  const { data, tinted } = await loadFont()
  const chars = [...text]
  const c = document.createElement('canvas')
  c.width = chars.reduce((w, ch) => w + advance(data, ch), 0) + 1
  c.height = data.h
  c.className = 'bmp'
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  ink.forEach((color, dx) => {
    let x = dx
    for (const ch of chars) {
      const gl = data.glyphs[ch]
      if (gl) g.drawImage(tinted.get(color)!, gl[0], gl[1], gl[2], data.h, x, 0, gl[2], data.h)
      x += advance(data, ch)
    }
  })
  return c
}

/** 폭 w 안에 들어가게 띄어쓰기에서 줄을 나눈다 (원작 문자열 함수엔 줄바꿈이 없어 호출부가 나눈다) */
export async function wrapLines(text: string, w: number) {
  const { data } = await loadFont()
  const width = (s: string) => [...s].reduce((n, ch) => n + advance(data, ch), 0)
  const lines: string[] = []
  for (const word of text.split(' ')) {
    const last = lines.length ? lines[lines.length - 1] : null
    if (last !== null && width(`${last} ${word}`) <= w) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

/** 요소 안 글자를 비트맵 글꼴 캔버스로 바꾼다 (글자 색은 class 로: pos·cur = 파랑, neg = 빨강). aria-label 로 글을 남긴다 */
export async function bitmapize(root: Element, selector: string) {
  await Promise.all([...root.querySelectorAll<HTMLElement>(selector)].map(async el => {
    const text = el.textContent ?? ''
    if (!text || el.querySelector('canvas.bmp')) return
    const ink = el.classList.contains('neg') ? INK.red : el.matches('.pos, .cur') ? INK.blue : INK.normal
    const wrap = Number(el.dataset.wrap)   // data-wrap = 줄 폭 (여러 줄, 줄마다 캔버스 하나)
    const cs = await Promise.all((wrap ? await wrapLines(text, wrap) : [text]).map(line => textCanvas(line, ink)))
    if (el.textContent !== text) return   // 그사이 다시 그려졌다
    el.setAttribute('aria-label', el.getAttribute('aria-label') ?? text)
    el.replaceChildren(...cs)
  }))
}
