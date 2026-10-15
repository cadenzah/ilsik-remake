// 물리 공격 모양 — 두 판 공통. 공격 유형 = 부대 대원 +0x151 (직업으로 정함, 124e:22ab) [확정 2026-10-16, 20ec:d900·124e:7147]
//   0 단일 (직업 0~7·19·20) · 1 마법 직업 (8~14 — 물리는 단일로 둔다 [근사]) · 2 기사 (15) · 3 포수 (16) · 4 궁수 (17) · 5 추전수 (18)
//   사거리 칸 = 무기 f2 마름모 (출발 칸 포함, f2 = 0 이면 자기 칸만). 유형 3~5 는 그중 공격자와 같은 행·열 칸만.
//   중심 = 그 칸에 선 유닛 (칸 표시 2 = 같은 편, 3 = 상대편): 기사는 같은 편 (자기 포함), 나머지는 상대편.
//   범위 = 기사·포수 1, 나머지 0 (무기 f3 는 물리에 안 쓴다). 맞는 유닛 = 범위 안의 상대편, 포수만 편을 가리지 않는다 (자기 포함).
//   맞을 유닛이 없는 중심은 고를 수 없다 (20ec:e657 → 칸 고르기로 되돌아감)
import { dist, inside, key, type Moves } from './grid'
import { S } from './state'
import type { Pos, Unit } from './unit'

export const attackKind = (u: Unit) => { const j = u.type.job; return j >= 8 && j <= 14 ? 1 : j >= 15 && j <= 18 ? j - 13 : 0 }
/** 범위 반경: 기사·포수 1 */
export const strikeArea = (u: Unit) => { const k = attackKind(u); return k === 2 || k === 3 ? 1 : 0 }

/** u 가 from 에 섰다고 보고 o 의 자리 */
const at = (o: Unit, u: Unit, from: Pos): Pos => o === u ? from : o

/** 사거리 칸인가 (그 칸의 유닛과 무관) */
export function inReach(u: Unit, from: Pos, c: Pos) {
  const d = dist(from, c)
  if (d < u.range[0] || d > u.range[1]) return false
  return attackKind(u) < 3 || from.x === c.x || from.y === c.y
}

/** 중심 c (그 칸의 유닛) 로 쳤을 때 맞는 유닛. from = 공격자가 설 자리 */
export function strikeTargets(u: Unit, c: Unit, from: Pos = u, units: Unit[] = S.units): Unit[] {
  const all = attackKind(u) === 3, r = strikeArea(u), cp = at(c, u, from)
  return units.filter(o => o.hp > 0 && (all || o.side !== u.side) && dist(at(o, u, from), cp) <= r)
}

/** 중심으로 고를 수 있는가: 사거리 칸 + 중심 편 + 맞을 상대가 있다 */
export function canAim(u: Unit, c: Unit, from: Pos = u, units: Unit[] = S.units) {
  if (c.hp <= 0 || !inReach(u, from, at(c, u, from))) return false
  if ((attackKind(u) === 2) !== (c.side === u.side)) return false
  return strikeTargets(u, c, from, units).length > 0
}

/** from 에서 고를 수 있는 중심들 */
export const aimsFrom = (u: Unit, from: Pos = u, units: Unit[] = S.units) => units.filter(c => canAim(u, c, from, units))

/** 이동해서 상대 t 를 맞힐 수 있는 (설 칸, 중심) 들 — 개선판 이동+공격·AI·첫 대원 고르기 */
export function strikePlans(u: Unit, moves: Moves, t?: Unit, units: Unit[] = S.units): { spot: Pos; center: Unit }[] {
  const out: { spot: Pos; center: Unit }[] = []
  for (const k of moves.keys()) {
    const spot = { x: k % 1000, y: Math.floor(k / 1000) }
    for (const c of aimsFrom(u, spot, units))
      if (!t || strikeTargets(u, c, spot, units).includes(t)) out.push({ spot, center: c })
  }
  return out
}

/** 범위 칸 (미리보기·연출) */
export function strikeCells(u: Unit, c: Pos): Pos[] {
  const r = strikeArea(u), out: Pos[] = []
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (Math.abs(dx) + Math.abs(dy) <= r && inside(S.map, c.x + dx, c.y + dy)) out.push({ x: c.x + dx, y: c.y + dy })
  return out
}

/** from 에서 맞힐 수 있는 칸 모두 (위협 범위 — 중심에 유닛이 있는지는 따지지 않는다). 키 = grid.key */
export function reachCells(u: Unit, from: Pos, out = new Set<number>()): Set<number> {
  const hi = u.range[1] + strikeArea(u)
  for (let dy = -hi; dy <= hi; dy++)
    for (let dx = -hi; dx <= hi; dx++) {
      const c = { x: from.x + dx, y: from.y + dy }
      if (!inReach(u, from, c)) continue
      for (const p of strikeCells(u, c)) if (p.x !== from.x || p.y !== from.y || attackKind(u) === 3) out.add(key(p.x, p.y))
    }
  return out
}
