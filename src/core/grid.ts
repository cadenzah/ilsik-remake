// 맵 격자: 이동 비용·이동 범위·경로·사거리 — 두 판 공통
import type { StageMap } from './data'
import type { Pos, Unit } from './unit'

export const key = (x: number, y: number) => y * 1000 + x

// 통행 [확정, 124e:2d08·124e:5039·20ec:a5e0]: 레이어2 값 ≤ 유닛 이동방식 이면 지나갈 수 있다. 이동방식 3(물)은 레이어2 3 칸만.
// 이동방식 1 평지 · 2 숲 · 3 물 · 4 비행. 칸마다 비용 1 (통행 마스크 0/1 위를 범람 35ae:1253)
export function moveCost(map: StageMap, x: number, y: number, kind: number): number {
  const v = map.layer2[y * map.w + x]
  return (kind === 3 ? v === 3 : v <= kind) ? 1 : Infinity
}

// 레이어2 이름 [추정: 통행하는 이동방식으로 붙임] 0 평지 · 1 거친 땅 · 2 숲 · 3 물 · 4 절벽 · 5 벽
const TERRAIN = ['평지', '거친 땅', '숲 (숲·비행 이동만)', '물 (물·비행 이동만)', '절벽 (비행 이동만)', '벽 (통행 불가)']
export function terrainName(map: StageMap, x: number, y: number): string {
  return TERRAIN[map.layer2[y * map.w + x]] ?? '벽 (통행 불가)'
}

export const inside = (map: StageMap, x: number, y: number) => x >= 0 && y >= 0 && x < map.w && y < map.h
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

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
      const nc = c + moveCost(map, nx, ny, u.type.moveKind)
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

/** 공격자가 서 있을 수 있는 칸 집합 중 대상에게 닿는 칸들 */
export function attackSpots(u: Unit, moves: Moves, t: Pos): Pos[] {
  const out: Pos[] = []
  for (const k of moves.keys()) {
    const p = { x: k % 1000, y: Math.floor(k / 1000) }
    if (inRange(u, p, t)) out.push(p)
  }
  return out
}
