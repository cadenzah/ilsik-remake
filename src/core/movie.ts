// 창세 프롤로그 (원작 0aa2:37f5, 프로그램을 켤 때 메뉴 앞 2ff8:04dc — 웹은 title.ts 가 페이지를 열 때) 와 엔딩 (0aa2:3982, 43장 뒤 2ff8:39f4) — formats.md "프롤로그·엔딩".
// 화면 전체 640×480 을 창에 맞춰 키운다 (promote.ts 와 같은 방식). 묶음 풀기·흰 막은 cutscene.ts. 자원 movie/ (export_web.py movies)
import { A } from './data'
import { PAL_MS, apply, biosMs, dropClip, dropWhite, loadClip, palette, type Clip } from './cutscene'
import { fadeIn, fadeOut } from './fade'
import { SONG, playMusic, stopMusic } from './music'
import { play, stop } from './sfx'

const sleep = (ms: number) => new Promise<void>(ok => setTimeout(ok, ms))

/** 검은 무대 + 640×480 캔버스. 누르기·키는 on 으로 */
function stage() {
  const root = document.createElement('div')
  root.id = 'movie'
  const cv = document.createElement('canvas')
  cv.width = 640; cv.height = 480
  root.append(cv)
  const fit = () => { cv.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / 640, innerHeight / 480)})` }
  fit()
  addEventListener('resize', fit)
  document.body.append(root)
  const g = cv.getContext('2d')!
  let poke: () => void = () => {}
  const onIn = (e: Event) => { e.stopPropagation(); e.preventDefault(); if (!(e instanceof KeyboardEvent && e.repeat)) poke() }   // 영상 아래 화면 (타이틀 메뉴 등) 으로 보내지 않는다
  addEventListener('pointerdown', onIn, true)
  addEventListener('keydown', onIn, true)
  return {
    g,
    clear() { g.fillStyle = '#000'; g.fillRect(0, 0, 640, 480) },
    on(fn: () => void) { poke = fn },
    close() { removeEventListener('resize', fit); removeEventListener('pointerdown', onIn, true); removeEventListener('keydown', onIn, true); root.remove() },
  }
}

/** 묶음 하나를 (x, y) 에 프레임별로 그리는 도구. 프레임 k = 바탕에 덩어리 k 개 */
function player(g: CanvasRenderingContext2D, c: Clip, x: number, y: number) {
  const px = c.px.slice(), clip = { ...c, px }
  const img = g.createImageData(c.w, c.h), out = new Uint32Array(img.data.buffer)
  let at = 0
  return {
    /** 고리 프레임 (덩어리 수 N = 프레임 0 으로 돌아옴) 을 뺀 마지막 = N − 1 */
    last: Math.max(0, c.frames.length - 1),
    show(f: number) {
      while (at < f) apply(clip, c.frames[at++])
      for (let i = 0; i < px.length; i++) out[i] = c.pal[px[i]]
      g.putImageData(img, x, y)
    },
  }
}

/** 깰 수 있는 기다림 */
function napper() {
  let wake: (() => void) | null = null
  return {
    nap: (ms: number) => ms > 0 ? new Promise<void>(ok => { const t = setTimeout(() => { wake = null; ok() }, ms); wake = () => { clearTimeout(t); wake = null; ok() } }) : Promise.resolve(),
    wake: () => wake?.(),
  }
}

/** 창세 프롤로그: ECPTIT.FAT 10묶음을 차례로, 프레임 0..N (고리 프레임까지 — 다음 묶음의 조각난 첫 화면으로 이어진다).
 *  원작 프레임 타이머 = 21번째 앞까지 70ms (조각이 모이는 부분), 그 뒤 150ms (자막이 한 글자씩). 키 하나 (kbhit) 면 통째로 건너뜀 → 검게.
 *  타이머는 그리기 앞에 걸고 뒤에서 기다리므로 (0aa2:38b1 → 8647 → ab16) 그리기가 느린 기계 (DOSBox 기본 cycles 등) 에서는 더 느려 보이지만, 그건 성능이고 의도는 타이머 값.
 *  웹은 그 타이머 그대로 (조각 모임 묶음당 약 0.6초). 장면 사이 대기만 웹 보탬 (사용자 결정 2026-11-06).
 *  화면이 어두운 상태에서 불러 어둡게 끝낸다 */
const PROLOGUE_MOSAIC_MS = biosMs(0x46)   // 조각이 모이는 프레임 하나 = 원작 타이머 70ms → BIOS 1틱 (평균 27.5ms)
const PROLOGUE_HOLD_MS = 2000   // 자막까지 다 나온 장면을 다음 장면 전에 보여 주는 시간 (웹 보탬)
export async function prologue() {
  if (typeof DecompressionStream === 'undefined') return false   // 묶음이 gzip 이라 못 푸는 옛 브라우저: 받지 않고 넘어간다
  stopMusic()   // 0aa2:392a
  const st = stage(), z = napper()
  let skip = false
  st.on(() => { skip = true; z.wake() })
  st.clear()
  const path = (k: number) => `movie/tit/${String(k).padStart(2, '0')}`
  let next = loadClip(path(0))
  await fadeIn(0)
  for (let k = 0; k < 10 && !skip; k++) {
    const c = await next
    if (k + 1 < 10) next = loadClip(path(k + 1))
    dropClip(path(k))
    if (!c) continue
    st.clear()   // 48e1:130a
    const p = player(st.g, c, 0, 0)
    for (let f = 0; f <= c.frames.length && !skip; f++) {
      const t = performance.now() + (f < 0x15 ? PROLOGUE_MOSAIC_MS : biosMs(0x96))
      p.show(f)
      await z.nap(t - performance.now())
      if (f === p.last && !skip) await z.nap(PROLOGUE_HOLD_MS)   // 다음이 고리 프레임 (다시 조각남)
    }
  }
  await fadeOut(PAL_MS)
  st.close()
  return skip   // 건너뛰었는가
}

/** 원작 엔딩 순서 (0aa2:3982). variant = 마지막 전투 일행에 채스 (초상 6) 가 있으면 +1, 소피아 (초상 28) 가 있으면 +2 (2ff8:39a7),
 *  route = 루트 (0~2). ECLIPSE3 묶음: variant → 4 → 5 → 6 → 7+route → (루트 2 만 10) → 11+variant → 15 */
export const endingClips = (route: number, variant: number) =>
  [variant, 4, 5, 6, 7 + route, ...(route === 2 ? [10] : []), 11 + variant, 15]

/** 엔딩 영상: 사바카 부활 (ECLIPSE2, 맵 창 자리 (68,57), 210ms, 소리 ECPANI 14) → 하얗게 → 엔딩 곡 (46) → 묶음마다 검게 → 첫 프레임 → 밝게 → 200ms 자동 재생 → 2초.
 *  끝에 원작 제작진·발행 화면 (ECPPLANE 0·1) 을 누를 때까지. 누르기·키 = 그 묶음의 남은 프레임 건너뛰기. 화면이 어두운 상태에서 불러 어둡게 끝낸다 */
export async function endingMovie(route: number, variant: number) {
  const st = stage(), z = napper()
  let skip = false
  st.on(() => { skip = true; z.wake() })
  st.clear()
  const seq = endingClips(route, variant), path = (k: number) => `movie/e3/${String(k).padStart(2, '0')}`
  let next = loadClip(path(seq[0]))
  const run = async (p: ReturnType<typeof player>, ms: number) => {   // 48e1:87d4 자동 재생 (프레임 0 은 이미 그림)
    skip = false
    for (let f = 1; f <= p.last && !skip; f++) {
      const t = performance.now() + biosMs(ms)
      p.show(f)
      await z.nap(t - performance.now())
    }
    if (skip) p.show(p.last)
    skip = false
  }

  const e2 = await loadClip('movie/e2')
  if (e2) {
    const p = player(st.g, e2, 68, 57)
    p.show(0)
    await fadeIn(PAL_MS)
    play('ani', 14)
    await run(p, 0xd2)
    await palette(1)   // 흰색으로
    await z.nap(biosMs(0x7d0))
    stop()
    await z.nap(biosMs(0x5dc))
  }
  dropClip('movie/e2')
  stopMusic()
  playMusic(SONG.ending)
  st.clear()
  await fadeOut(PAL_MS)   // 흰 화면에서 검게 (0aa2:3b4a)
  dropWhite()
  for (let i = 0; i < seq.length; i++) {
    const c = await next
    if (i + 1 < seq.length) next = loadClip(path(seq[i + 1]))
    dropClip(path(seq[i]))
    if (!c) continue
    await fadeOut(PAL_MS)
    const p = player(st.g, c, 0, 0)
    p.show(0)
    await fadeIn(PAL_MS)
    await run(p, 0xc8)
    if (i + 1 < seq.length) await z.nap(biosMs(0x7d0))
  }
  // 제작진·발행 화면 (ECPPLANE 0·1): 검게 → 그림 → 밝게 → 누를 때까지 (getch)
  for (const name of ['staff', 'publish']) {
    await fadeOut(PAL_MS)
    const img = new Image()
    img.src = `${A}/ui/${name}.png`
    await img.decode().catch(() => {})
    st.clear()
    st.g.drawImage(img, 0, 0)
    await fadeIn(PAL_MS)
    await sleep(300)   // 앞 화면에서 누른 것이 바로 넘기지 않게
    await new Promise<void>(ok => st.on(ok))
  }
  await fadeOut(PAL_MS)
  st.close()
}
