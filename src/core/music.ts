// 배경음악 — 두 판 공통 (formats.md "배경음악"). 원작: 3716:0325(eclipse.fmt, 번호) 로 불러 3716:0f17(0) 재생 (끝나면 처음부터), 0f8e(0) 멈춤.
// 곡 번호: 전투 = 장 − 1 (장 앞 대화부터 장 뒤 장면·컷신까지 이어짐), 정비 화면 44, 제작진 소개 45, 엔딩 46. 메인 메뉴·대륙 지도·창세 프롤로그는 무음.
// 소리는 브라우저에서 만든다: music.worklet.ts (원작 드라이버 fmDriver + OPL2 흉내 opl2). 자원 export_web.py music → music/NN.cmf
import { A } from './data'
import { onSetting, onVolume, setSetting, setting, volumeGain } from './settings'
import { audio } from './sfx'
import workletUrl from './music.worklet?worker&url'

export const SONG = { camp: 44, credits: 45, ending: 46 } as const
/** 장 n 의 전투 곡 (2ff8:0a7e: 전투 순서표의 장 번호 − 1) */
export const stageSong = (n: number) => n - 1

const VOLUME = 0.8

let node: Promise<AudioWorkletNode | null> | null = null, gain: GainNode | null = null
// 음악을 끄면 소리만 0 — 곡은 계속 흘러 다시 켜면 그 지점부터 (요즘 게임 방식, 두 판 공통 웹 편의). 원작 「음악」 은 멈추고 켜면 처음부터였다 (20ec:e969)
const level = () => setting('music') ? VOLUME * volumeGain('music') : 0
function applyGain() { if (gain) gain.gain.value = level() }
let cur = -1, seq = 0
const songs = new Map<number, Promise<ArrayBuffer | null>>()

function player() {
  if (!node) {
    const c = audio()
    node = !c?.audioWorklet ? Promise.resolve(null) : c.audioWorklet.addModule(workletUrl).then(() => {
      const n = new AudioWorkletNode(c, 'eclipse-music', { numberOfInputs: 0, outputChannelCount: [1] })
      const g = gain = c.createGain()
      g.gain.value = level()
      n.connect(g).connect(c.destination)
      return n
    }).catch(() => null)
  }
  return node
}

function load(n: number) {
  let p = songs.get(n)
  if (!p) {
    p = fetch(`${A}/music/${String(n).padStart(2, '0')}.cmf`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null)
    songs.set(n, p)
  }
  return p
}

/** 곡 재생. 같은 곡이 이미 나오고 있으면 그대로 (again = 처음부터 다시) */
export function playMusic(n: number, again = false) {
  if (n < 0 || (n === cur && !again)) return   // 꺼 두어도 튼다 (소리만 0)
  const id = ++seq
  const c = audio()
  if (c?.state === 'suspended') void c.resume().catch(() => {})
  void Promise.all([player(), load(n)]).then(([p, b]) => {
    if (!p || !b || id !== seq) return
    p.port.postMessage({ cmf: b.slice(0) })
    cur = n
  })
}

/** 멈춤 (원작 0f8e(0)). 울리던 음은 자연스럽게 사라진다 */
export function stopMusic() {
  quiet()
}

function quiet() {
  ++seq
  if (cur < 0) return
  cur = -1
  void node?.then(p => p?.port.postMessage({ stop: true }))
}

/** 원작 시스템 창 「음악」 [열기][닫기]·정비 화면 「음악」·설정 화면 모두 이것: 곡은 그대로 흐르고 소리만 끄고 켠다 */
export const setMusicOn = (on: boolean) => setSetting('music', on)
onSetting('music', on => {
  applyGain()
  if (on) { const c = audio(); if (c?.state === 'suspended') void c.resume().catch(() => {}) }   // 꺼 둔 채 들어온 화면이면 막혀 있을 수 있다
})
onVolume('music', applyGain)

export const musicOn = () => setting('music')
