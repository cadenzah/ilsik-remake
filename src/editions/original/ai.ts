// 적 AI. 행동 여부는 원작 부대 상태(+0x235) [확정, 20ec:a419]:
//   0 행동 · 1 경계 대기 (일행이 닿으면 또는 맞으면 0) · 2 대기 (장 이벤트로만 풀림) · 3 행동, 이동력 0 · 4 숨김
// 행동할 때의 대상 고르기는 근사 [근사]: 공격 가능한 대상 중 가장 큰 피해(처치 우선), 없으면 가장 가까운 상대 쪽으로.
// 마법은 공격 유형 1 (직업 8~14, 124e:22ab) 유닛만 [확정]. 어떤 마법을 어디에 쓰는지는 근사 [근사, 124e:284a / 4d43 미분석]: 아래 점수가 물리보다 크면.
import type { StageMap } from '../../core/data'
import type { AiPlan } from '../../core/edition'
import { attackSpots, DIRS, dist, inside, key, moveCost, reachable } from '../../core/grid'
import type { Magic } from '../../core/data'
import type { Pos, Unit } from '../../core/unit'
import { aiCaster, spellCenters, spellTargets, spellsOf } from '../../core/magic'
import { rules } from './rules'

/** 상태 1 깨어남: 이동력+1 걸음 안(통행 마스크)에 일행(부대 0) 대원이 있다. 다른 유닛에 막히는지는 근사로 무시 */
function partyInReach(map: StageMap, units: Unit[], u: Unit): boolean {
  const party = new Set(units.filter(o => o.troop === 0 && o.hp > 0).map(o => key(o.x, o.y)))
  const cost = new Map([[key(u.x, u.y), 0]])
  const queue: [number, number, number][] = [[0, u.x, u.y]]
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0])
    const [c, x, y] = queue.shift()!
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy
      if (!inside(map, nx, ny)) continue
      const nc = c + moveCost(map, nx, ny, u.type.moveKind)
      if (nc > u.mov + 1 || nc >= (cost.get(key(nx, ny)) ?? Infinity)) continue
      if (party.has(key(nx, ny))) return true
      cost.set(key(nx, ny), nc)
      queue.push([nc, nx, ny])
    }
  }
  return false
}

export function planFor(map: StageMap, units: Unit[], u: Unit, troopState: number[]): AiPlan {
  const stay = { unit: u, dest: { x: u.x, y: u.y } }
  if (troopState[u.troop] === 1 && partyInReach(map, units, u)) troopState[u.troop] = 0
  if (troopState[u.troop] === 1 || troopState[u.troop] === 2) return stay
  if (u.fatigue > 70) return { ...stay, rest: true }   // [추정] 원작 20ec:abe1 피로 > 70 분기 = 휴식 (세부 미분석)
  const foes = units.filter(o => o.hp > 0 && o.side !== u.side)
  const moves = reachable(map, units, u)
  let best: AiPlan | null = null
  let bestScore = -Infinity
  for (const f of foes) {
    const spots = attackSpots(u, moves, f)
    if (!spots.length) continue
    // 같은 대상이면 이동이 적은 칸 우선
    spots.sort((a, b) => dist(a, u) - dist(b, u))
    const [lo, hi] = rules.damageRange(map, u, f, spots[0])
    const score = (lo >= f.hp ? 1000 : 0) + (lo + hi) / 2 - f.def * 0.1
    if (score > bestScore) {
      bestScore = score
      best = { unit: u, dest: spots[0], target: f }
    }
  }
  if (aiCaster(u)) {
    const spell = bestSpell(units, u, moves)
    if (spell && spell.score > bestScore) return spell.plan
  }
  if (best) return best

  const nearest = foes.sort((a, b) => dist(a, u) - dist(b, u))[0]
  if (!nearest) return stay
  let dest: Pos = { x: u.x, y: u.y }
  for (const k of moves.keys()) {
    const p = { x: k % 1000, y: Math.floor(k / 1000) }
    if (dist(p, nearest) < dist(dest, nearest)) dest = p
  }
  return { unit: u, dest }
}

/** 마법 점수 [근사]: 피해 합 (처치 +1000), 회복은 잃은 생명이 30% 넘는 대상만, 강화·약화·중독·혼수는 아직 안 걸린 대상만.
 *  같으면 덜 움직이는 자리. 점수 0 이하면 쓰지 않는다 */
function spellScore(units: Unit[], u: Unit, m: Magic, c: Pos, from: Pos): number {
  let score = 0
  for (const t of spellTargets(rules, u, m, c, units, from)) {
    const h = rules.spell(u, t, m)
    if (h.kind === 'hp') score += h.value + (h.value >= t.hp ? 1000 : 0)
    else if (h.kind === 'heal') score += t.hp < t.maxHp * 0.7 ? h.value * 1.2 : 0
    else if (h.kind === 'stat') score += Math.sign(t.mods[h.stat]) === Math.sign(h.value) ? 0 : Math.abs(h.value) * 0.8
    else if (h.kind === 'tire') score += h.value * 0.5
    else if (h.kind === 'poison') score += t.poison ? 0 : 12 + t.hp * 0.2
    else if (h.kind === 'coma') score += t.coma ? 0 : 25
    else if (h.kind === 'cure') score += (h.what !== 'coma' && t.poison ? 15 : 0) + (h.what !== 'poison' && t.coma ? 25 : 0)
  }
  return score
}

function bestSpell(units: Unit[], u: Unit, moves: Map<number, number>): { plan: AiPlan; score: number } | null {
  let best: { plan: AiPlan; score: number } | null = null
  for (const m of spellsOf(u)) {
    if (!rules.canCast(u, m)) continue
    for (const k of moves.keys()) {
      const from = { x: k % 1000, y: Math.floor(k / 1000) }
      for (const c of spellCenters(rules, u, m, units, from)) {
        const score = spellScore(units, u, m, c, from) - dist(from, u) * 0.01
        if (score > 0.5 && score > (best?.score ?? -Infinity)) best = { plan: { unit: u, dest: from, magic: m, at: c }, score }
      }
    }
  }
  return best
}
