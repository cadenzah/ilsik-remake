// 적 AI (근사): 아군이 경계 범위(이동력 + WAKE) 안에 들어오기 전엔 대기.
// 깨어나면 공격 가능한 대상 중 가장 큰 피해(처치 우선)를 주는 쪽을 고르고,
// 없으면 가장 가까운 아군 쪽으로 최대한 다가간다.
import type { StageMap } from './data'
import { attackSpots, damageRange, dist, reachable, type Pos, type Unit } from './rules'

const WAKE = 3

export interface AiPlan { unit: Unit; dest: Pos; target?: Unit }

export function planFor(map: StageMap, units: Unit[], u: Unit): AiPlan {
  const foes = units.filter(o => o.hp > 0 && o.side !== u.side)
  if (!u.awake && foes.some(f => dist(f, u) <= u.mov + u.range[1] + WAKE)) u.awake = true
  if (!u.awake) return { unit: u, dest: { x: u.x, y: u.y } }
  const moves = reachable(map, units, u)
  let best: AiPlan | null = null
  let bestScore = -Infinity
  for (const f of foes) {
    const spots = attackSpots(u, moves, f)
    if (!spots.length) continue
    const [lo, hi] = damageRange(u, f)
    const score = (lo >= f.hp ? 1000 : 0) + (lo + hi) / 2 - f.def * 0.1
    if (score > bestScore) {
      bestScore = score
      // 같은 대상이면 이동이 적은 칸 우선
      spots.sort((a, b) => dist(a, u) - dist(b, u))
      best = { unit: u, dest: spots[0], target: f }
    }
  }
  if (best) return best

  const nearest = foes.sort((a, b) => dist(a, u) - dist(b, u))[0]
  if (!nearest) return { unit: u, dest: { x: u.x, y: u.y } }
  let dest: Pos = { x: u.x, y: u.y }
  for (const k of moves.keys()) {
    const p = { x: k % 1000, y: Math.floor(k / 1000) }
    if (dist(p, nearest) < dist(dest, nearest)) dest = p
  }
  return { unit: u, dest }
}
