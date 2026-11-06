// 사용자 설정 (localStorage). 개선판 메인 메뉴 '설정' 에서 바꾼다. 원작판은 쓰지 않는다 (글꼴은 늘 원작, 로고 효과음·효과음·배경음악만 따른다 — 효과음·음악은 원작 시스템 창 '음향'·'음악' 으로도 바꾼다)
const KEYS = {
  bitmapFont: 'eclipse.bitmapFont',   // 원작 비트맵 글꼴 (FULLSOFT.FNT) 로 화면 글자를 그린다. 기본 켬
  logoSound: 'eclipse.introSound',    // 로고 연출의 천둥 효과음. 기본 끔 (옛 '인트로 소리' 키 그대로)
  sound: 'eclipse.sound',             // 전투 효과음 (원작 '음향' +0x1cb4, 기본 켬). 원작은 저장하지 않지만 웹은 기억한다
  music: 'eclipse.music',             // 배경음악 (원작 '음악' +0x1cb3, 기본 켬). 원작 시스템 창·정비 화면 「음악」 으로도 바꾼다
  // 개선판 편의 (ux-proposal.md 12·18). 원작판은 무시
  fastEnemy: 'eclipse.fastEnemy',     // 적·NPC 차례 빠르게
  shortAnim: 'eclipse.shortAnim',     // 전투 연출 짧게
  quickAttack: 'eclipse.quickAttack', // 공격 확인창 없이 바로
  modernUi: 'eclipse.modernUi',       // 설정 이름 '개선된 UI' (코드에선 현대식 화면): 창틀 없이 맵 가득·다듬은 창. 끄면 원작 창틀
  tipLines: 'eclipse.tipLines',       // 새 시스템을 처음 겪을 때 인물 한 줄 (tips-proposal.md, core/tips.ts)
  tipCards: 'eclipse.tipCards',       // 그 뒤의 안내 카드
} as const
const DEFAULTS: Record<keyof typeof KEYS, boolean> = { bitmapFont: true, logoSound: false, sound: true, music: true, fastEnemy: false, shortAnim: false, quickAttack: false, modernUi: false, tipLines: true, tipCards: true }

export type Setting = keyof typeof KEYS

export function setting(k: Setting): boolean {
  try {
    const v = localStorage.getItem(KEYS[k])
    return v === null ? mem.get(k) ?? DEFAULTS[k] : v === '1'
  } catch { return mem.get(k) ?? DEFAULTS[k] }
}

const watchers = new Map<Setting, (on: boolean) => void>()
/** 설정이 바뀌면 부른다 (배경음악: 어느 화면에서 바꿔도 바로 멈추거나 튼다) */
export const onSetting = (k: Setting, fn: (on: boolean) => void) => { watchers.set(k, fn) }

const mem = new Map<Setting, boolean>()   // localStorage 를 못 쓸 때 이번 화면에서만
export function setSetting(k: Setting, on: boolean) {
  const was = setting(k)
  mem.set(k, on)
  try { localStorage.setItem(KEYS[k], on ? '1' : '0') } catch { /* 저장 불가 */ }
  if (was !== on) watchers.get(k)?.(on)
}

// ---------- 난이도 (개선판만, B1 제안 7 — balance-proposal.md "1번 피해식") ----------
// 세 단계 = 적이 칠 때의 물리 피해 계수 (remake/index.ts). 바꾸면 다음 전투 (다시 하기 포함) 부터. 판의 기록에는 쓴 가장 낮은 난이도 (플래그 diff0~2)
export const DIFFICULTIES = ['쉬움', '보통', '어려움'] as const
export type Difficulty = 0 | 1 | 2
const DIFF_KEY = 'eclipse.difficulty'
let diffMem: Difficulty | null = null
export function difficulty(): Difficulty {
  try { const v = Number(localStorage.getItem(DIFF_KEY) ?? NaN); if (v === 0 || v === 1 || v === 2) return v } catch { /* 저장 불가 */ }
  return diffMem ?? 1
}
export function setDifficulty(d: Difficulty) {
  diffMem = d
  try { localStorage.setItem(DIFF_KEY, String(d)) } catch { /* 저장 불가 */ }
}
export const nextDifficulty = () => setDifficulty(((difficulty() + 1) % 3) as Difficulty)
export const DIFF_DESC = '적이 주는 피해 (어려움은 적도 협공). 다음 전투부터 적용'
/** 판 플래그에서 쓴 가장 낮은 난이도 (없으면 undefined = 난이도 설정 전의 기록) */
export function lowestDifficulty(flags: string[]): Difficulty | undefined {
  const used = ([0, 1, 2] as const).filter(d => flags.includes(`diff${d}`))
  return used[0]
}

/** 설정 화면 목록 (타이틀 '설정'·개선판 정비 화면 '설정') */
export const SETTINGS: { k: Setting; label: string; desc: string }[] = [   // desc = 짧은 한 줄 (없으면 빈 글자)
  { k: 'bitmapFont', label: '원작 글꼴', desc: '끄면 시스템 글꼴' },
  { k: 'modernUi', label: '개선된 UI', desc: '창틀 없이 맵을 화면 가득' },
  { k: 'logoSound', label: '로고 효과음', desc: '시작 로고의 천둥소리' },
  { k: 'music', label: '배경음악', desc: '' },
  { k: 'sound', label: '인게임 효과음', desc: '' },
  { k: 'fastEnemy', label: '적 차례 빠르게', desc: '' },
  { k: 'shortAnim', label: '전투 연출 짧게', desc: '' },
  { k: 'quickAttack', label: '공격 확인 생략', desc: '대상을 누르면 바로 공격' },
  { k: 'tipLines', label: '이야기 속 안내', desc: '새 규칙을 처음 겪을 때 동료의 한마디' },
  { k: 'tipCards', label: '안내 카드', desc: '새 규칙을 처음 겪을 때 규칙 설명 카드' },
]

// ---------- 음량 (배경음악·효과음, 웹 추가). 0~100, 10 단위, 기본 100 = 예전 크기. 원작판도 따른다 ----------
// 소리 크기는 (값/100)² 로 곱한다 (사람 귀에 고르게 들리도록). 설정 화면에서 켬/끔 스위치 바로 아래 줄
export type VolumeKind = 'music' | 'sound'
const VOL_KEYS: Record<VolumeKind, string> = { music: 'eclipse.musicVolume', sound: 'eclipse.soundVolume' }
const volMem = new Map<VolumeKind, number>()
const volWatchers = new Map<VolumeKind, (gain: number) => void>()
export function volume(k: VolumeKind): number {
  try { const v = Number(localStorage.getItem(VOL_KEYS[k]) ?? NaN); if (v >= 0 && v <= 100) return Math.round(v / 10) * 10 } catch { /* 저장 불가 */ }
  return volMem.get(k) ?? 100
}
/** 소리에 곱할 값 (0~1) */
export const volumeGain = (k: VolumeKind) => (volume(k) / 100) ** 2
export function setVolume(k: VolumeKind, v: number) {
  v = Math.max(0, Math.min(100, Math.round(v / 10) * 10))
  volMem.set(k, v)
  try { localStorage.setItem(VOL_KEYS[k], String(v)) } catch { /* 저장 불가 */ }
  volWatchers.get(k)?.(volumeGain(k))
}
/** 음량이 바뀌면 부른다 (재생 중인 소리에도 바로) */
export const onVolume = (k: VolumeKind, fn: (gain: number) => void) => { volWatchers.set(k, fn) }
