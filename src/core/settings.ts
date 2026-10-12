// 사용자 설정 (두 판 공통, localStorage). 메인 메뉴 '설정' 에서 바꾼다
const KEYS = {
  bitmapFont: 'eclipse.bitmapFont',   // 원작 비트맵 글꼴 (FULLSOFT.FNT) 로 화면 글자를 그린다. 기본 켬
  logoSound: 'eclipse.introSound',    // 로고 연출의 천둥 효과음. 기본 끔 (옛 '인트로 소리' 키 그대로)
} as const
const DEFAULTS: Record<keyof typeof KEYS, boolean> = { bitmapFont: true, logoSound: false }

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
