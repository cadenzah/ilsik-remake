// 사용자 설정 (localStorage). 개선판 메인 메뉴 '설정' 에서 바꾼다. 원작판은 쓰지 않는다 (글꼴은 늘 원작, 로고 효과음·효과음만 따른다 — 효과음은 원작 시스템 창 '음향' 으로도 바꾼다)
const KEYS = {
  bitmapFont: 'eclipse.bitmapFont',   // 원작 비트맵 글꼴 (FULLSOFT.FNT) 로 화면 글자를 그린다. 기본 켬
  logoSound: 'eclipse.introSound',    // 로고 연출의 천둥 효과음. 기본 끔 (옛 '인트로 소리' 키 그대로)
  sound: 'eclipse.sound',             // 전투 효과음 (원작 '음향' +0x1cb4, 기본 켬). 원작은 저장하지 않지만 웹은 기억한다
  // 개선판 편의 (ux-proposal.md 12·18). 원작판은 무시
  fastEnemy: 'eclipse.fastEnemy',     // 적·NPC 차례 빠르게
  shortAnim: 'eclipse.shortAnim',     // 전투 연출 짧게
  quickAttack: 'eclipse.quickAttack', // 공격 확인창 없이 바로
  modernUi: 'eclipse.modernUi',       // 설정 이름 '개선된 UI' (코드에선 현대식 화면): 창틀 없이 맵 가득·다듬은 창. 끄면 원작 창틀
} as const
const DEFAULTS: Record<keyof typeof KEYS, boolean> = { bitmapFont: true, logoSound: false, sound: true, fastEnemy: false, shortAnim: false, quickAttack: false, modernUi: false }

export type Setting = keyof typeof KEYS

export function setting(k: Setting): boolean {
  try {
    const v = localStorage.getItem(KEYS[k])
    return v === null ? DEFAULTS[k] : v === '1'
  } catch { return DEFAULTS[k] }
}

export function setSetting(k: Setting, on: boolean) {
  try { localStorage.setItem(KEYS[k], on ? '1' : '0') } catch { /* 저장 불가 — 이번 화면에서만 */ }
}

/** 설정 화면 목록 (타이틀 '설정'·개선판 정비 화면 '설정') */
export const SETTINGS: { k: Setting; label: string; title: string }[] = [
  { k: 'bitmapFont', label: '원작 글꼴', title: '개선판: 원작 비트맵 글꼴로 글자를 그린다 (끄면 시스템 글꼴). 원작판은 늘 원작 글꼴' },
  { k: 'modernUi', label: '개선된 UI', title: '개선판: 원작 창틀 없이 맵을 화면 가득, 다듬은 창·색 칸 범위 (끄면 원작 창틀을 복각한 화면)' },
  { k: 'logoSound', label: '로고 효과음', title: '시작 로고 연출의 천둥소리' },
  { k: 'sound', label: '효과음', title: '공격·마법·쓰러짐·레벨업 효과음 (원작판은 전투 시스템 창 「음향」 으로도 바꾼다)' },
  { k: 'fastEnemy', label: '적 차례 빠르게', title: '개선판: 적·NPC 가 움직이는 속도를 높인다' },
  { k: 'shortAnim', label: '전투 연출 짧게', title: '개선판: 공격·쓰러짐 연출을 짧게' },
  { k: 'quickAttack', label: '공격 확인 생략', title: '개선판: 「전 투」 확인창 없이 대상을 누르면 바로 공격' },
]
