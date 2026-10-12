// 원작판 전투 규칙. 피해는 아직 근사 [근사] — 원작 공식은 0aa2:0e17 (k 0~8) 역분석으로 채운다 (formats.md, rules.md)
import type { Rules } from '../../core/edition'
import type { Unit } from '../../core/unit'

/** [근사] 공격력 - 방어력×0.7 을 기준으로 ±15% */
function damageRange(a: Unit, d: Unit): [number, number] {
  const base = Math.max(1, a.atk - d.def * 0.7)
  return [Math.max(1, Math.floor(base * 0.85)), Math.max(1, Math.ceil(base * 1.15))]
}

export const rules: Rules = {
  damageRange,
  rollDamage(a, d) {
    const [lo, hi] = damageRange(a, d)
    return lo + Math.floor(Math.random() * (hi - lo + 1))
  },
  // [추정] 무기 f2: 1 근접, 2~3 원거리 (formats.md)
  weaponRange(t, items) {
    const f2 = items.get(t.equip[0])?.f2 ?? 1
    return f2 >= 2 ? [1, f2] : [1, 1]
  },
  // [확정] 20ec:038e: int(최대HP × 0.1 + 2), 최대HP 까지. 피로도 30 줄인다 (피로는 아직 미구현)
  restHeal: u => Math.trunc(u.maxHp * 0.1 + 2),
}

/** 행동 순서 키 [확정] 0aa2:0e17(유닛, 0) = int(100 × (1.1 − 0.01×피로) × (1.2 − 0.01×피로) × (0.3×HP% + 0.7×민첩)).
 *  HP% = HP×100 div 최대HP (정수), 최대HP 0 이면 0. 피로는 아직 미구현이라 0 */
export function orderKey(u: Unit, fatigue = 0): number {
  if (!u.maxHp) return 0
  const hpPct = Math.floor((u.hp * 100) / u.maxHp)
  return Math.floor(100 * (1.1 - 0.01 * fatigue) * (1.2 - 0.01 * fatigue) * (0.3 * hpPct + 0.7 * u.agi))
}

/** 원작 124e:26b7: 라운드마다 모든 부대·대원을 순서 키 내림차순으로 한 명씩. 같으면 부대·대원 순 (0aa2:0327 버블 정렬) */
export function order(units: Unit[]): Unit[][] {
  return units.map(u => ({ u, k: orderKey(u) }))
    .sort((a, b) => b.k - a.k || a.u.troop - b.u.troop || a.u.member - b.u.member)
    .map(({ u }) => [u])
}
