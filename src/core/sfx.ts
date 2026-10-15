// 효과음 — 두 판 공통 (formats.md "효과음 호출부"). 원작: 3716:04ae(파일, 번호) 로 소리 버퍼 하나에 불러 두고 3716:0f17(1) 로 재생.
// 버퍼가 하나라 새 소리가 앞 소리를 끊는다 — 웹도 한 번에 하나. 설정 sound (원작 시스템 창 '음향' +0x1cb4) 가 꺼져 있으면 내지 않는다.
// 자원: export_web.py sfx → sfx/e1 (ECLIPSE1.FVT), sfx/e2 (ECLIPSE2.FVT, 마법 id 별), sfx/ani (ECPANI.FVT, 컷신·전직)
import { A } from './data'
import { setSetting, setting } from './settings'

export type Bank = 'e1' | 'e2' | 'ani'
/** ECLIPSE1.FVT 고정 번호. 0~110 은 유닛 초상 번호별 공격·시전음 */
export const SFX = { cannon: 105, levelUp: 108, gotItem: 109, upgrade: 110, death: 111 } as const

const VOLUME = 0.5   // 로고 천둥과 같은 1/2
const LATE_MS = 400  // 불러오기가 이만큼 늦으면 그 소리는 버린다 (장면이 이미 지나감)

let ctx: AudioContext | null = null, out: GainNode | null = null, cur: AudioBufferSourceNode | null = null, seq = 0
const bufs = new Map<string, Promise<AudioBuffer | null>>()

function audio() {
  if (!ctx) {
    try { ctx = new AudioContext(); out = ctx.createGain(); out.gain.value = VOLUME; out.connect(ctx.destination) } catch { return null }
  }
  return ctx
}

function load(bank: Bank, n: number) {
  const k = `${bank}/${n}`
  let p = bufs.get(k)
  if (!p) {
    const c = audio()
    if (!c) return Promise.resolve(null)
    p = fetch(`${A}/sfx/${bank}/${String(n).padStart(3, '0')}.wav`)
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText)))
      .then(b => c.decodeAudioData(b))
      .catch(() => null)
    bufs.set(k, p)
  }
  return p
}

/** 미리 불러 둔다 (원작은 256색 모드 전투 로드 때 유닛별 공격음을 캐시, 124e:18a5) */
export function preload(bank: Bank, ns: Iterable<number>) {
  if (!setting('sound')) return
  for (const n of ns) if (n >= 0) void load(bank, n)
}

/** 재생. 앞 소리는 끊는다 */
export function play(bank: Bank, n: number) {
  if (!setting('sound') || n < 0) return
  const c = audio()
  if (!c) return
  if (c.state === 'suspended') void c.resume().catch(() => {})
  const id = ++seq, t = performance.now()
  void load(bank, n).then(b => {
    if (!b || !ctx || !out || id !== seq || performance.now() - t > LATE_MS) return
    stop()
    const s = ctx.createBufferSource()
    s.buffer = b
    s.connect(out)
    s.onended = () => { if (cur === s) cur = null }
    s.start()
    cur = s
  })
}

export function stop() {
  try { cur?.stop() } catch { /* 이미 끝남 */ }
  cur = null
}

/** 원작 시스템 창 「음향」 [열기][닫기] */
export function setSoundOn(on: boolean) {
  setSetting('sound', on)
  if (!on) stop()
}
