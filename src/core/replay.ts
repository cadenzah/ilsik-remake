// 다시 하기·진엔딩 기록 (.claude/docs/replay-design.md, 개선판): 분기점, 엔딩을 본 루트, 찾은 조건 사건, 도감(만난 유닛·손에 넣은 도구), 이어받을 장비
import type { Camp } from './campaign'

/** 루트 조건을 가르는 열쇠 도구 — "다른 길로"에 이어받지 않는다 (깨진금괴·요정피리·고대은화) */
export const KEY_ITEMS = [180, 168, 179]

/** 장 지도에 표시하는 조건 사건. 클리어 뒤 일행에 그 유닛이 있으면 찾은 것 */
export const FOUND: { id: string; n: number; label: string; unit: number }[] = [
  { id: 'guardian13', n: 13, label: '고신전의 수호신이 깨어나다', unit: 19 },
  { id: 'guardian21', n: 21, label: '수호자가 옛 힘을 되찾다', unit: 20 },
  { id: 'black27', n: 27, label: '흑기사 아보라한', unit: 24 },
  { id: 'louis36', n: 36, label: '어른이 된 루이스', unit: 23 },
  { id: 'sophia38', n: 38, label: '깨어난 소피아', unit: 28 },
]

/** 진로 짧은 이름 (장 지도·다른 길로) */
export const ROUTE_NAMES = ['유하 마을의 크란', '북쪽 동굴의 소녀', '제국으로 곧장']

/** 진엔딩 숨은 장 (세 루트 엔딩을 모두 보면 열림) */
export const HIDDEN = [44, 45]
export const trueEndingOpen = (endings: number[] = []) => [0, 1, 2].every(r => endings.includes(r))

/** 이어받을 장비: 열쇠 도구를 뺀 장착 장비 + 소지품 중 무기·방어구(cat 0·1) */
export function carryOf(now: Camp, cat: (id: number) => number | undefined): { equip: Camp['equip']; items: number[] } {
  const equip = Object.fromEntries(Object.entries(now.equip ?? {}).map(([t, e]) => [t, e.map(id => KEY_ITEMS.includes(id) ? 0 : id)])) as Camp['equip']
  return { equip, items: now.items.filter(id => !KEY_ITEMS.includes(id) && (cat(id) ?? 9) <= 1) }
}

/** 분기점 상태 + 이어받은 장비 */
export function withCarry(branch: Camp, carry?: { equip: Camp['equip']; items: number[] }): Camp {
  return { ...branch, equip: { ...branch.equip, ...carry?.equip }, items: [...branch.items, ...carry?.items ?? []] }
}
