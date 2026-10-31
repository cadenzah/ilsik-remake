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
} as const
const DEFAULTS: Record<keyof typeof KEYS, boolean> = { bitmapFont: true, logoSound: false, sound: true, music: true, fastEnemy: false, shortAnim: false, quickAttack: false, modernUi: false }

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
export const DIFF_TITLE = '개선판: 적이 주는 물리 피해. 보통 = 원작판 수준. 다음 전투부터 적용, 기록에는 이 판에서 쓴 가장 낮은 난이도가 남는다'
/** 판 플래그에서 쓴 가장 낮은 난이도 (없으면 undefined = 난이도 설정 전의 기록) */
export function lowestDifficulty(flags: string[]): Difficulty | undefined {
  const used = ([0, 1, 2] as const).filter(d => flags.includes(`diff${d}`))
  return used[0]
}

/** 설정 화면 목록 (타이틀 '설정'·개선판 정비 화면 '설정') */
export const SETTINGS: { k: Setting; label: string; title: string }[] = [
  { k: 'bitmapFont', label: '원작 글꼴', title: '개선판: 원작 비트맵 글꼴로 글자를 그린다 (끄면 시스템 글꼴). 원작판은 늘 원작 글꼴' },
  { k: 'modernUi', label: '개선된 UI', title: '개선판: 원작 창틀 없이 맵을 화면 가득, 다듬은 창·색 칸 범위 (끄면 원작 창틀을 복각한 화면)' },
  { k: 'logoSound', label: '로고 효과음', title: '시작 로고 연출의 천둥소리' },
  { k: 'music', label: '배경음악', title: '원작 FM 음악 (전투·정비 화면·제작진·엔딩). 원작판은 전투 시스템 창·정비 화면 「음악」 으로도 바꾼다' },
  { k: 'sound', label: '인게임 효과음', title: '공격·마법·쓰러짐·레벨업 효과음 (원작판은 전투 시스템 창 「음향」 으로도 바꾼다)' },
  { k: 'fastEnemy', label: '적 차례 빠르게', title: '개선판: 적·NPC 가 움직이는 속도를 높인다' },
  { k: 'shortAnim', label: '전투 연출 짧게', title: '개선판: 공격·쓰러짐 연출을 짧게' },
  { k: 'quickAttack', label: '공격 확인 생략', title: '개선판: 「전 투」 확인창 없이 대상을 누르면 바로 공격' },
]
