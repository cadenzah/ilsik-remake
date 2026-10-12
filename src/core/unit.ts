// 유닛과 능력치 — 두 판 공통. 원작에서 확정된 부분만 둔다.
import type { Item, UnitType } from './data'

export type Side = 'ally' | 'enemy'

export interface Unit {
  uid: number
  type: UnitType
  side: Side
  troop: number; member: number   // 원작 부대 번호·대원 번호 (U[troop.member])
  x: number; y: number
  hp: number; maxHp: number
  atk: number; def: number; spi: number; agi: number; mov: number
  range: [number, number]
  acted: boolean
  moved: boolean                 // 이번 차례에 움직였다 (휴식 판정, 이동 취소 때 되돌린다)
  facing: 'down' | 'up' | 'left' | 'right'
  // 렌더용 보간 위치
  px: number; py: number
  alpha: number
  flash: number
}

export interface Pos { x: number; y: number }

export type Stats = Pick<Unit, 'maxHp' | 'atk' | 'def' | 'spi' | 'agi' | 'mov'>

/** PAD 기본값 + 장착 장비 보정 [확정]. 원작 0aa2:179d 와 같다 (전투 로드 시 모든 부대에 적용).
 *  능력치 번호 1 생명, 2 정신, 3 역량, 4 방어, 6 이동, 7 민첩, 9~16 = 1~8 감소. 5 마법·8 체력은 이 능력치들과 무관 */
export function equippedStats(t: UnitType, items: Map<number, Item>): Stats {
  const s: Stats = { maxHp: t.hp, atk: t.atk, def: t.def, spi: t.spi, agi: t.agi, mov: t.mov }
  const field: (keyof Stats | null)[] = [null, 'maxHp', 'spi', 'atk', 'def', null, 'mov', 'agi', null]
  for (const id of t.equip) {
    const it = items.get(id)
    if (!it) continue
    for (const [n, v] of [it.stat, it.stat2]) {
      const f = field[n > 8 ? n - 8 : n]
      if (f) s[f] += n > 8 ? -v : v
    }
  }
  return s
}
