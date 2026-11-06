// 장 사이 컷신 (원작 ECLIPSE1.FAT 묶음, formats.md "컷신 재생"). 자원 cut/NN.bin = 원작 묶음 바이트 그대로 (export_web.py cuts):
// 팔레트 768 (6비트) + u32 폭·높이 + 바탕 그림 (PCX식 RLE) + FLC 프레임 묶음 (덩어리는 모두 7 = SS2 단어 변화). 프레임 k = 바탕에 덩어리 k 개를 적용한 것,
// 덩어리 수 N 의 마지막 것은 고리 (프레임 N = 프레임 0) 라 원작은 프레임 0..N−1 을 그린다 (8장 루프가 di == 10 을 검사, N = 11). 원작 재생부 (2ff8 캠페인 루프, 124e 전투) 는 묶음마다 손으로 짠 루프라 단계표 CUTS 로 옮겼다:
// 프레임마다 타이머(aaea) → 그 프레임 앞 일 → 그리기(8647) → 뒤 일 → 타이머 끝까지 기다림(ab16). 시간은 BIOS 틱 (55ms) 단위라 평균값으로.
// 그리는 자리: 원작 화면 좌표. 맵 창 (68,57) 504×384 기준이라 개선판 넓은 화면에서는 맵 창 가운데로 옮기고, 맵 창을 다 덮는 컷신은 둘레를 검게.
import { busy } from './loading'
import { A } from './data'
import { fadeIn, fadeOut } from './fade'
import { mapRect, hud, view } from './screen'
import { pieceUrl } from './skin'
import { play, stop } from './sfx'
import { dialogueOpen } from './dialogue'

/** 원작 기다림 aaea(ms)·ab16: ms/55 틱 (버림) 이 지날 때까지 → 시작 시점이 틱 안 어디냐에 따라 (틱−1)~틱 × 55ms. 평균을 쓴다 */
export const biosMs = (ms: number) => Math.max(0.5, Math.floor(ms / 55) - 0.5) * 55
/** 팔레트 효과 48e1:0e92 = 64단계 × 수직동기 (70Hz) */
export const PAL_MS = Math.round(64 * 1000 / 70)

type Act = { sound: number } | { talk: true } | { timer: number } | { wait: true } | { pal: 1 | 2 | -1 | -2 } | { clear: true } | { draw0: true }
interface CutDef {
  x: number; y: number                 // 원작 화면 좌표 (왼쪽 위)
  ms: number                           // 프레임 타이머 (원작 값, biosMs 로 바꿔 씀)
  screen?: boolean                     // 화면 전체를 지우고 그림 (21장) — 아니면 맵 창 기준
  overlay?: boolean                    // 전투 중 맵 위에 잠깐 (끝나면 지운다, 원작 34ca 로 뒤 그림 되돌림)
  delay?: number                       // 불러오기 전 기다림 (전투 화면 그대로)
  start?: Act[]                        // 루프 전
  before?: Record<number, Act[]>       // 그 프레임 그리기 전
  after?: Record<number, Act[]>        // 그 프레임 그린 뒤
  hold?: number                        // 끝 프레임 뒤 기다림
  holdAfterStop?: boolean              // 소리를 먼저 멈추고 기다림 (39·40장)
}
const hold = (ms: number): Act[] => [{ timer: ms }, { wait: true }]

// 묶음 번호 → 원작 재생 순서 (tools/anim.py trace 로 읽음). 소리 = ECPANI.FVT 번호, talk = 그 컷신에 딸린 장면 (첫 프레임 위 대화)
export const CUTS: Record<number, CutDef> = {
  0: { x: 68, y: 57, ms: 0xb4, start: [{ draw0: true }, { talk: true }, { sound: 1 }],                 // 8장 뒤 (2ff8:1cae): 첫 프레임 위 장면 2:8, 9프레임에 소리 0 과 하얗게
       after: { 9: [{ sound: 0 }, { pal: 1 }, ...hold(0x5dc)], 10: [{ pal: 2 }] }, hold: 0x4b0 },
  1: { x: 68, y: 57, ms: 0xbe, delay: 0x5dc, before: { 1: [...hold(0x5dc), { sound: 2 }] }, hold: 0x4b0 },   // 10장 (2ff8:2174)
  2: { x: 68, y: 57, ms: 0xbe, before: { 1: [{ sound: 3 }] }, hold: 0x4b0 },                          // 11장 (2ff8:22c1)
  3: { x: 68, y: 57, ms: 0xbe, before: { 1: [...hold(0x5dc), { sound: 4 }] }, hold: 0x4b0 },          // 13장 요정피리 → 수호신 (2ff8:24ed)
  4: { x: 69, y: 183, ms: 0xfa, overlay: true },                                                      // 17장 전투 시작 장면 0:171 뒤 (124e:c7f3, 87d4 자동 재생)
  5: { x: 68, y: 57, ms: 0xa0, start: [{ sound: 13 }], hold: 0x4b0 },                                 // 29장 (2ff8:30c2)
  6: { x: 68, y: 57, ms: 0xbe, start: [{ sound: 5 }], hold: 0x4b0 },                                  // 32장 (2ff8:31f8)
  7: { x: 68, y: 57, ms: 0xc8, start: [{ pal: -1 }, { draw0: true }, { pal: -2 }],                    // 37장 (2ff8:35b5)
       before: { 1: [{ talk: true }], 2: [{ sound: 6 }] }, hold: 0x4b0 },
  8: { x: 68, y: 57, ms: 0xbe, delay: 0x5dc, before: { 1: [{ timer: 0x5dc }, { talk: true }, { wait: true }, { sound: 7 }] },   // 40장 (2ff8:3853)
       hold: 0x4b0, holdAfterStop: true },
  9: { x: 218, y: 183, ms: 0xdc, overlay: true, start: [{ sound: 8 }], hold: 0xbb8 },                 // 43장 사바카 장면 1:43 뒤 (124e:dc19)
  10: { x: 265, y: 0, ms: 0x96, screen: true, start: [{ pal: -1 }, { clear: true }, { pal: -2 }, { sound: 11 }],   // 21장 고대은화 → 수호자 강화 (2ff8:2c78)
        before: { 1: [{ sound: 9 }], 25: [{ sound: 10 }] } },
  12: { x: 68, y: 57, ms: 0xa0, before: { 1: [{ talk: true }, { sound: 6 }] }, hold: 0x4b0, holdAfterStop: true },   // 39장 (2ff8:36fe)
}

/** 장면 키 뒤에 바로 이어지는 컷신 (전투 중 — 전투 후 컷신은 scenes.json post 의 anim 단계) */
export const CUT_AFTER: Record<string, number> = { '0:171': 4, '1:43': 9 }

/** 장면 뒤 정지 그림 (battle-ui 조각, 원작 화면 좌표 = 맵 창 기준으로 옮김, ms 동안).
 *  17장 0:172 「폭탄이 있습니다!」 뒤: ECLIPSE.OTH 8 을 맵을 다시 그린 위 (197,180) 에 2000ms (124e:c82e~c8e4, 48e1:2bcf → aaea(0x7d0)) → 0:173 */
export const STILLS: Record<number, { piece: string; x: number; y: number; ms: number }> = { 8: { piece: 'oth.8', x: 197, y: 180, ms: 2000 } }   // OTH 번호 → 자리·시간 (개선판 대본 `still N`)
export const STILL_AFTER: Record<string, number> = { '0:172': 8 }
export async function showStill(s: { piece: string; x: number; y: number; ms: number }) {
  const m = mapRect(), img = document.createElement('img')
  img.className = 'cutscene still'
  img.alt = ''
  img.src = pieceUrl(s.piece)
  Object.assign(img.style, { left: `${m.x + s.x + Math.round((m.w - 504) / 2) - 68}px`, top: `${m.y + s.y + Math.round((m.h - 384) / 2) - 57}px` })
  hud.append(img)
  await sleep(s.ms)
  img.remove()
}

// ---------- 풀기 ----------

export interface Clip { w: number; h: number; pal: Uint32Array; px: Uint8Array; frames: Uint8Array[] }

const clips = new Map<string, Promise<Clip | null>>()
/** 묶음 하나 (path = assets 아래, 확장자 없이). 프롤로그·엔딩 (movie.ts) 도 쓴다 */
/** gzip 으로 내보낸 묶음 (프롤로그, export_web.py movies) 이면 푼다. 묶음은 6비트 팔레트로 시작해 첫 바이트가 64 미만이라 0x8b 와 겹치지 않는다 */
async function gunzip(b: ArrayBuffer): Promise<ArrayBuffer> {
  const h = new Uint8Array(b, 0, 2)
  if (h[0] !== 0x1f || h[1] !== 0x8b) return b
  return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}
export function loadClip(path: string) {
  let p = clips.get(path)
  if (!p) {
    p = fetch(`${A}/${path}.bin`).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(gunzip).then(b => parse(new Uint8Array(b))).catch(() => null)
    clips.set(path, p)
  }
  return p
}
export const loadCut = (n: number) => loadClip(`cut/${String(n).padStart(2, '0')}`)
/** 다 쓴 큰 묶음 (프롤로그 1MB 남짓) 을 기억에서 버린다 */
export const dropClip = (path: string) => { clips.delete(path) }

function parse(b: Uint8Array): Clip {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const pal = new Uint32Array(256)
  for (let i = 0; i < 256; i++) pal[i] = 0xff000000 | Math.min(255, b[i * 3 + 2] * 4) << 16 | Math.min(255, b[i * 3 + 1] * 4) << 8 | Math.min(255, b[i * 3] * 4)
  const w = v.getUint32(768, true), h = v.getUint32(772, true)
  const px = new Uint8Array(w * h)
  let i = 776, o = 0
  while (o < px.length) {
    const c = b[i++]
    if (c >= 0xc0) { px.fill(b[i++], o, Math.min(px.length, o + (c & 0x3f))); o += c & 0x3f } else px[o++] = c
  }
  const nf = v.getUint16(i + 4, true), frames: Uint8Array[] = []
  let p = i + 6
  for (let f = 0; f < nf && p + 16 <= b.length; f++) {
    const size = v.getUint32(p, true)
    if (v.getUint16(p + 4, true) !== 0xf1fa) break
    frames.push(b.subarray(p + 16, p + size))
    p += size
  }
  return { w, h, pal, px, frames }
}

/** 프레임 하나 (덩어리 7 = SS2) 를 px 에 적용 */
export function apply(c: Clip, fr: Uint8Array) {
  const v = new DataView(fr.buffer, fr.byteOffset, fr.byteLength), { w, px } = c
  for (let p = 0; p + 6 <= fr.length;) {
    const size = v.getUint32(p, true), type = v.getUint16(p + 4, true)
    if (size < 6) break
    if (type === 7) {
      let q = p + 6, lines = v.getUint16(q, true), y = 0
      q += 2
      while (lines > 0) {
        const op = v.getInt16(q, true); q += 2
        if ((op & 0xc000) === 0xc000) { y -= op; continue }
        if ((op & 0xc000) === 0x8000) { px[y * w + w - 1] = op & 0xff; continue }
        let x = 0
        for (let k = 0; k < op; k++) {
          x += fr[q]
          const n = v.getInt8(q + 1); q += 2
          const at = y * w + x
          if (n > 0) { px.set(fr.subarray(q, q + 2 * n), at); q += 2 * n; x += 2 * n }
          else { for (let j = 0; j < -n; j++) { px[at + 2 * j] = fr[q]; px[at + 2 * j + 1] = fr[q + 1] } q += 2; x -= 2 * n }
        }
        y++; lines--
      }
    }
    p += size
  }
}

// ---------- 재생 ----------

let shown: HTMLElement | null = null   // 전투 후 컷신은 끝 프레임을 남겨 둔다 (원작은 다음 화면까지 그대로) → clearCut
let whiteVeil: HTMLElement | null = null

/** 남아 있는 컷신 화면을 지운다 (다음 전투·화면으로 넘어갈 때) */
export function clearCut() {
  shown?.remove()
  shown = null
  whiteVeil?.remove()
  whiteVeil = null
}

/** 흰 막을 바로 걷는다 (검은 막이 덮은 뒤에) */
export function dropWhite() {
  whiteVeil?.remove()
  whiteVeil = null
}

const sleep = (ms: number) => new Promise<void>(ok => setTimeout(ok, ms))

/** 흰 막 (팔레트를 흰색 쪽으로, 모드 1·2). 검정 (−1·−2) 은 fade.ts 의 막 */
export async function palette(mode: 1 | 2 | -1 | -2) {
  if (mode === -1) return fadeOut(PAL_MS)
  if (mode === -2) return fadeIn(PAL_MS)
  if (!whiteVeil) {
    whiteVeil = document.createElement('div')
    whiteVeil.className = 'cut-white'
    document.body.append(whiteVeil)
    void whiteVeil.offsetWidth
  }
  whiteVeil.style.transitionDuration = `${PAL_MS}ms`
  whiteVeil.classList.toggle('on', mode === 1)
  await sleep(PAL_MS)
}

/** 컷신 n 재생. talk = 딸린 대화 (그 자리에서 재생). 클릭·키 = 남은 프레임·기다림 건너뛰기 (대화는 건너뛰지 않고 끝 프레임 위에서 본다) */
export async function playCut(n: number, talk?: () => Promise<void>) {
  const d = CUTS[n]
  if (!d) return
  if (d.delay) await sleep(biosMs(d.delay))
  const c = await busy(loadCut(n))
  if (!c) { await talk?.(); return }
  clearCut()
  const px = c.px.slice(), clip: Clip = { ...c, px }
  const root = document.createElement('div')
  root.className = 'cutscene'
  let x = d.x, y = d.y
  if (d.screen) {        // 화면 전체 (21장, 지운 뒤): 원작 640×480 을 논리 화면 가운데에
    Object.assign(root.style, { left: '0', top: '0', width: `${view.w}px`, height: `${view.h}px` })
    x += Math.round((view.w - 640) / 2); y += Math.round((view.h - 480) / 2)
  } else {               // 맵 창 기준: 원작 맵 창 (68,57) 504×384 를 지금 맵 창 가운데에. 덮는 컷신은 맵 창을 검게 (첫 프레임을 그릴 때)
    const m = mapRect()
    x += Math.round((m.w - 504) / 2) - 68; y += Math.round((m.h - 384) / 2) - 57
    if (d.overlay) { x += m.x; y += m.y; Object.assign(root.style, { left: '0', top: '0' }) }
    else Object.assign(root.style, { left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px` })
  }
  const cv = document.createElement('canvas')
  cv.width = c.w; cv.height = c.h
  Object.assign(cv.style, { left: `${x}px`, top: `${y}px` })
  const g = cv.getContext('2d')!, img = g.createImageData(c.w, c.h), out = new Uint32Array(img.data.buffer)
  let at = 0   // px 에 적용된 프레임 수 (0 = 바탕 = 프레임 0)
  const show = (f: number) => {
    while (at < f) apply(clip, c.frames[at++])
    for (let i = 0; i < px.length; i++) out[i] = c.pal[px[i]]
    g.putImageData(img, 0, 0)
    if (!cv.isConnected) { root.append(cv); if (!d.overlay && !d.screen) root.style.background = '#000' }
  }
  const last = Math.max(0, c.frames.length - 1)

  let skip = false, talked = !talk, timer = 0, wake: (() => void) | null = null
  const nap = (ms: number) => ms > 0 && !skip ? new Promise<void>(ok => { const t = setTimeout(() => { wake = null; ok() }, ms); wake = () => { clearTimeout(t); wake = null; ok() } }) : Promise.resolve()
  const onSkip = () => { if (dialogueOpen() || skip) return; skip = true; stop(); wake?.() }
  const run = async (acts: Act[] = []) => {
    for (const a of acts) {
      if ('sound' in a) { if (!skip) play('ani', a.sound) }
      else if ('talk' in a) { if (!talked) { talked = true; await talk!() } }
      else if ('timer' in a) timer = performance.now() + biosMs(a.timer)
      else if ('wait' in a) await nap(timer - performance.now())
      else if ('pal' in a) { if (!skip || a.pal === 2 || a.pal === -2) await palette(a.pal) }
      else if ('clear' in a) root.style.background = '#000'
      else show(0)
    }
  }

  hud.append(root)
  shown = root
  root.addEventListener('pointerdown', onSkip)
  addEventListener('keydown', onSkip, true)
  try {
    await run(d.start)
    for (let f = 0; f <= last && !skip; f++) {
      timer = performance.now() + biosMs(d.ms)
      await run(d.before?.[f])
      show(f)
      await run(d.after?.[f])
      await nap(timer - performance.now())
    }
    if (skip) show(last)
    if (d.holdAfterStop) stop()
    await nap(biosMs(d.hold ?? 0))
    stop()
    await run([{ talk: true }])   // 건너뛰어 못 본 대화
  } finally {
    root.removeEventListener('pointerdown', onSkip)
    removeEventListener('keydown', onSkip, true)
    if (whiteVeil?.classList.contains('on')) await palette(2)
    if (d.overlay) clearCut()
  }
}
