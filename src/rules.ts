// 전투 규칙. 현재는 근사치 — .claude/docs/rules.md 와 맞춰 유지한다.
import type { StageMap, UnitType } from './data'

export type Side = 'ally' | 'enemy'

export interface Unit {
  uid: number
  type: UnitType
  side: Side
  troop: number; member: number   // 원작 부대 번호·대원 번호 (U[troop.member])
  x: number; y: number
  hp: number; maxHp: number
  atk: number; def: number; mov: number
  range: [number, number]
  acted: boolean
  awake: boolean   // 적: 경계 범위에 아군이 들어오면 true, 이후 계속 추격
  facing: 'down' | 'up' | 'left' | 'right'
  // 렌더용 보간 위치
  px: number; py: number
  alpha: number
  flash: number
}

export interface Pos { x: number; y: number }

export const key = (x: number, y: number) => y * 1000 + x

// 레이어2: 0 평지, 2 숲·바위, 4 절벽
export function moveCost(map: StageMap, x: number, y: number): number {
  const v = map.layer2[y * map.w + x]
  if (v >= 4) return Infinity
  if (v >= 2) return 2
  return 1
}

export function terrainName(map: StageMap, x: number, y: number): string {
  const v = map.layer2[y * map.w + x]
  return v >= 4 ? '절벽 (통행 불가)' : v >= 2 ? '숲 (이동 비용 2)' : '평지'
}

export const inside = (map: StageMap, x: number, y: number) => x >= 0 && y >= 0 && x < map.w && y < map.h
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

/** 정지 가능한 칸 → 직전 칸. `chain` 은 통과만 가능한 칸까지 포함한 전체 경로 정보. */
export type Moves = Map<number, number> & { chain: Map<number, number> }

/** 이동 범위. 적 유닛은 통과 불가, 같은 편은 통과 가능하나 정지 불가. */
export function reachable(map: StageMap, units: Unit[], u: Unit): Moves {
  const occ = new Map<number, Unit>()
  for (const o of units) if (o.hp > 0 && o !== u) occ.set(key(o.x, o.y), o)
  const cost = new Map<number, number>([[key(u.x, u.y), 0]])
  const prev = new Map<number, number>([[key(u.x, u.y), -1]])
  const queue: [number, number, number][] = [[0, u.x, u.y]]
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0])
    const [c, x, y] = queue.shift()!
    if (c > (cost.get(key(x, y)) ?? Infinity)) continue
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy
      if (!inside(map, nx, ny)) continue
      const o = occ.get(key(nx, ny))
      if (o && o.side !== u.side) continue
      const nc = c + moveCost(map, nx, ny)
      if (nc > u.mov || nc >= (cost.get(key(nx, ny)) ?? Infinity)) continue
      cost.set(key(nx, ny), nc)
      prev.set(key(nx, ny), key(x, y))
      queue.push([nc, nx, ny])
    }
  }
  // 다른 유닛이 서 있는 칸에는 멈출 수 없다
  const stops = new Map([...prev].filter(([k]) => !occ.has(k))) as Moves
  stops.chain = prev
  return stops
}

export function pathTo(moves: Moves, x: number, y: number): Pos[] {
  const prev = moves.chain
  const out: Pos[] = []
  let k = key(x, y)
  while (k !== -1 && prev.has(k)) {
    out.unshift({ x: k % 1000, y: Math.floor(k / 1000) })
    k = prev.get(k)!
  }
  return out
}

export const dist = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
export const inRange = (u: Unit, from: Pos, t: Pos) => {
  const d = dist(from, t)
  return d >= u.range[0] && d <= u.range[1]
}

/** 피해 범위 [최소, 최대]. 공격력 - 방어력×0.7 을 기준으로 ±15%. */
export function damageRange(a: Unit, d: Unit): [number, number] {
  const base = Math.max(1, a.atk - d.def * 0.7)
  return [Math.max(1, Math.floor(base * 0.85)), Math.max(1, Math.ceil(base * 1.15))]
}

export function rollDamage(a: Unit, d: Unit): number {
  const [lo, hi] = damageRange(a, d)
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

/** 공격자가 서 있을 수 있는 칸 집합 중 대상에게 닿는 칸들 */
export function attackSpots(u: Unit, moves: Moves, t: Pos): Pos[] {
  const out: Pos[] = []
  for (const k of moves.keys()) {
    const p = { x: k % 1000, y: Math.floor(k / 1000) }
    if (inRange(u, p, t)) out.push(p)
  }
  return out
}
