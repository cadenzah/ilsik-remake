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
  fatigue: number                // 피로 0~100 (런타임 +0x3a). 공격·이동으로 쌓이고 휴식으로 준다, 공격·방어력·행동 순서를 떨어뜨린다
  steps: number                  // 이번 차례에 움직인 칸 (피로 계산)
  range: [number, number]
  acted: boolean
  moved: boolean                 // 이번 차례에 움직였다 (휴식 판정, 이동 취소 때 되돌린다)
  facing: 'down' | 'up' | 'left' | 'right'
  pose?: number                  // 공격·시전 동작 (FIG) 프레임. 없으면 걷기 그림 (MOV)
  // 마법 상태 [확정, rules.md "원작 전투 공식"]. atk·def·spi·agi 는 현재치 = base + mods (강화 +, 약화 −, 남은량 = |mods|)
  base: Record<BuffStat, number> // 최대치 (장비 보정 뒤)
  mods: Record<BuffStat, number>
  poison: number; coma: number   // 남은 차례 (걸리면 3)
  ticked: boolean                // 이번 라운드 차례 처리 (중독·혼수·강화 되돌림) 를 했다
  // 렌더용 보간 위치
  px: number; py: number
  alpha: number
  flash: number
}

export type BuffStat = 'atk' | 'def' | 'spi' | 'agi'

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

/** 강화·약화를 반영한 현재 능력치로 맞춘다 */
export function applyMods(u: Unit) {
  for (const k of ['atk', 'def', 'spi', 'agi'] as const) u[k] = Math.max(0, u.base[k] + u.mods[k])
}
