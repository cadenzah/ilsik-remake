// 원작판 전투 규칙 [확정] — 행동 실행 20ec:6e92, 수치 함수 0aa2:0e17(유닛, x, k) (rules.md "원작 전투 공식").
// 전투 계산에 난수가 없다: 명중 판정·치명타·피해 흔들림·반격 모두 없음. 정수화는 0 쪽 절사, 중간값 일부는 float32
import type { StageMap } from '../../core/data'
import type { Rules } from '../../core/edition'
import type { Pos, Unit } from '../../core/unit'

const f32 = Math.fround
const tr = Math.trunc
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** 피로 배율 F(f) = (1.5 − 0.01(101−f))(1.6 − 0.01(101−f)). 피로 0 → 0.2499, 피로가 쌓일수록 커져 공격·방어력이 떨어진다 */
const F = (f: number) => (1.5 - (101 - f) * 0.01) * (1.6 - (101 - f) * 0.01)
/** k1 물리 공격력 / k2 물리 방어력 (능력치는 현재값) */
export const k1 = (u: Unit) => tr(f32(0.7 * u.atk + 0.3 * u.agi) * f32((2.6 - F(u.fatigue)) * 100))
export const k2 = (u: Unit) => tr(f32(0.7 * u.def + 0.3 * u.agi) * f32((2.4 - F(u.fatigue)) * 100))

/** 지형 보정 (6e92:77a5·7a05): LML 레이어3 3 이 100%. 이동방식 3(물)·4(비행) 은 고정. 물리 공격에만 */
const layer3 = (map: StageMap, p: Pos) => map.layer3[p.y * map.w + p.x] ?? 3
const flier = (u: Unit) => u.type.moveKind === 3 || u.type.moveKind === 4
const terrAtk = (map: StageMap, u: Unit, at: Pos) => flier(u) ? 106 : 94 + 2 * layer3(map, at)
const terrDef = (map: StageMap, u: Unit) => flier(u) ? 115 : 85 + 5 * layer3(map, u)

/** 물리 피해 (6e92:7932): trunc((A·0.01·Ta − D·0.01·Td)·0.01) 를 [1, 99], 대상 HP 까지 */
function damage(map: StageMap, a: Unit, d: Unit, at: Pos = a) {
  const v = tr((k1(a) * 0.01 * terrAtk(map, a, at) - k2(d) * 0.01 * terrDef(map, d)) * 0.01)
  return Math.min(clamp(v, 1, 99), d.hp)
}

export const rules: Rules = {
  damageRange(map, a, d, at) {
    const v = damage(map, a, d, at)
    return [v, v]
  },
  rollDamage: (map, a, d) => damage(map, a, d),
  // 무기 EAD f2 = 사거리, f3 = 범위 (0aa2:17dd → +0x44/+0x46, 무기 없으면 1/0). 사거리 범람 모양·최소 사거리는 [추정] 마름모·1
  weaponRange(t, items) {
    const f2 = items.get(t.equip[0])?.f2 ?? 1
    return [1, Math.max(1, f2)]
  },
  // 휴식 20ec:038e: HP += int(최대HP × 0.1 + 2), 피로 −= min(30, 피로)
  restHeal: u => Math.trunc(u.maxHp * 0.1 + 2),
  restFatigue: u => Math.max(0, u.fatigue - 30),
  /** 행동 뒤 피로. 물리 공격 (8f16): += trunc((6·부하 + 82)·(1 + 0.1·(경로길이 + 5))·0.033), 경로길이 = 움직인 칸 + 1.
   *  이어서 이동 (a317): += 움직인 칸. 단계마다 상한 100. 맞아도 늘지 않는다 */
  fatigueAfter(u, attacked) {
    let f = u.fatigue
    if (attacked) f = Math.min(100, tr(f + (6 * u.type.rank + 82) * (1 + 0.1 * (u.steps + 1 + 5)) * 0.033))
    return Math.min(100, f + u.steps)
  },
}

/** 행동 순서 키 [확정] 0aa2:0e17(유닛, 0) = int(100 × (1.1 − 0.01×피로) × (1.2 − 0.01×피로) × (0.3×HP% + 0.7×민첩)).
 *  HP% = HP×100 div 최대HP (정수), 최대HP 0 이면 0 */
export function orderKey(u: Unit): number {
  if (!u.maxHp) return 0
  const hpPct = Math.floor((u.hp * 100) / u.maxHp)
  return Math.floor(100 * (1.1 - 0.01 * u.fatigue) * (1.2 - 0.01 * u.fatigue) * (0.3 * hpPct + 0.7 * u.agi))
}

/** 원작 124e:26b7: 라운드마다 모든 부대·대원을 순서 키 내림차순으로 한 명씩. 같으면 부대·대원 순 (0aa2:0327 버블 정렬) */
export function order(units: Unit[]): Unit[][] {
  return units.map(u => ({ u, k: orderKey(u) }))
    .sort((a, b) => b.k - a.k || a.u.troop - b.u.troop || a.u.member - b.u.member)
    .map(({ u }) => [u])
}
