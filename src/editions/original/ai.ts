// 적 AI. 행동 여부는 원작 부대 상태(+0x235) [확정, 20ec:a419]:
//   0 행동 · 1 경계 대기 (일행이 닿으면 또는 맞으면 0) · 2 대기 (장 이벤트로만 풀림) · 3 행동, 이동력 0 · 4 숨김
// 행동할 때의 대상 고르기는 근사 [근사]: 공격 가능한 대상 중 가장 큰 피해(처치 우선), 없으면 가장 가까운 상대 쪽으로.
//   범위 공격 (기사·포수, core/attack.ts) 은 맞는 유닛 점수 합, 같은 편이 맞으면 뺀다 (원작 AI 도 포수 중심 둘레의 같은 편 칸을 센다 124e:596e)
// 마법은 공격 유형 1 (직업 8~14, 124e:22ab) 유닛만 [확정]. 원작판 = 원작 마법 직업 AI 그대로 (casterPlan, 물리 공격 없음 [확정]),
//   개선판 = 마법 점수가 물리보다 크면 마법 [근사] (bestSpell). 물리 쪽 AI (124e:4d43) 의 대상 점수는 아직 근사
import type { StageMap } from '../../core/data'
import type { AiPlan } from '../../core/edition'
import { DIRS, dist, inside, key, moveCost, reachable } from '../../core/grid'
import { aimsFrom, attackKind, strikeTargets } from '../../core/attack'
import type { Magic } from '../../core/data'
import type { Pos, Unit } from '../../core/unit'
import { aiCaster, inSpellRange, spellCenters, spellTargets, spellsOf } from '../../core/magic'
import { k4, rules } from './rules'

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

/** 원작판 = 마법 직업은 원작 우선순위 AI (casterPlan), 개선판 = 마법도 물리와 점수로 견줌 [근사] */
export const makePlanFor = (originalCasters: boolean) => (map: StageMap, units: Unit[], u: Unit, troopState: number[]) =>
  planFor(map, units, u, troopState, originalCasters)

export function planFor(map: StageMap, units: Unit[], u: Unit, troopState: number[], originalCasters = true): AiPlan {
  const stay = { unit: u, dest: { x: u.x, y: u.y } }
  if (troopState[u.troop] === 1 && partyInReach(map, units, u)) troopState[u.troop] = 0
  if (troopState[u.troop] === 1 || troopState[u.troop] === 2) return stay
  if (u.fatigue > 70) return { ...stay, rest: true }   // [추정] 원작 20ec:abe1 피로 > 70 분기 = 휴식 (세부 미분석)
  const foes = units.filter(o => o.hp > 0 && o.side !== u.side)
  const moves = reachable(map, units, u)
  if (originalCasters && attackKind(u) === 1) return casterPlan(units, u, moves) ?? stay   // 원작 2ff8:1480: 공격 유형 1 은 124e:284a (물리 공격 없음)
  let best: AiPlan | null = null
  let bestScore = -Infinity
  for (const k of moves.keys()) {
    const spot = { x: k % 1000, y: Math.floor(k / 1000) }
    for (const c of aimsFrom(u, spot, units)) {
      let score = -dist(spot, u) * 0.01, own = 0   // 같으면 이동이 적은 칸
      for (const t of strikeTargets(u, c, spot, units)) {
        const [lo, hi] = rules.damageRange(map, u, t, spot)
        const v = (lo >= t.hp ? 1000 : 0) + (lo + hi) / 2 - t.def * 0.1
        if (t.side === u.side) { own++; score -= 1.5 * Math.max(1, v) } else score += v
      }
      if ((!own || score > 0) && score > bestScore) {   // 같은 편이 맞으면 남는 게 있을 때만
        bestScore = score
        best = { unit: u, dest: spot, target: c }
      }
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

// ---------- 원작 마법 직업 AI (124e:284a) [확정 2026-10-23, 역어셈블] ----------
// 물리 공격은 없다 (행동 종류 = 공격 유형 1 = 마법, 2ff8:1480 → 284a → 426f). 효과 16가지를 아래 순서로 보며 (2f9c, cs:4d23)
// 그 효과의 마법이 유닛 목록에 있으면 (첫 번째 것, 피로 + 마법 피로 ≤ 90) 이동력 + 사거리 안의 해당 편 유닛 중 조건에 맞는 것을 모아
// 키로 안정 정렬 (0aa2:0327, 같으면 원래 순서) → 첫 효과에서 대상이 생기면 그 효과로 정한다 (뒤 효과는 안 봄).
// 대상마다 차례로 그 대상을 사거리에 두는 이동 칸을 찾고 (대상에서 가까운 칸부터), 찾으면 그 칸에서 대상 칸을 중심으로 시전.
// 못 찾거나 효과가 하나도 없으면 회복·혼수해제·해독·생명상해 넷만 (피로 ≤ 100) 다시 보고 첫 대상 쪽으로 걸어가기만 한다 (4318~4c5c). 그것도 없으면 제자리.
type Key = (t: Unit) => number | null   // null = 대상 아님
const hpPct = (t: Unit) => Math.floor(t.hp * 100 / Math.max(1, t.maxHp))
const notUp = (s: 'atk' | 'def' | 'spi' | 'agi'): Key => t => t.mods[s] > 0 ? null : 0     // 원작은 강화·약화 남은 차례가 따로 — 웹은 mods 부호로
const notDown = (s: 'atk' | 'def' | 'spi' | 'agi'): Key => t => t.mods[s] < 0 ? null : 0
/** [MAD 효과, 같은 편?, 내림차순?, 조건·키] — 우선순위 순 (cs:4d23 · 조건 cs:4d03) */
const CASTER_ORDER: [number, boolean, boolean, Key][] = [
  [0, true, false, t => hpPct(t) < 50 ? hpPct(t) : null],                      // 생명회복: 생명 50% 미만, 적은 쪽부터
  [6, true, true, t => t.coma > 0 ? t.coma : null],                            // 혼수해제: 남은 차례 많은 쪽부터
  [5, true, true, t => t.poison > 0 ? t.poison : null],                        // 해독
  [14, true, true, t => t.coma > 0 || t.poison > 0 ? Math.max(t.coma, t.poison) : null],   // 상태회복
  [13, false, false, t => t.coma === 0 ? 0 : null],                            // 혼수: 안 걸린 대상
  [12, false, false, t => t.poison === 0 ? 0 : null],                          // 중독
  [15, false, true, t => t.fatigue],                                           // 피로증가: 피로 많은 쪽부터
  [7, false, false, t => Math.floor(t.hp / Math.max(1, t.maxHp)) === 0 ? 0 : k4(t)],   // 생명상해: 다친 대상 먼저 (생명 div 최대 = 0 → 키 0, 원작 정수 나눗셈), 아니면 마법 방어력 낮은 쪽
  [8, false, false, notDown('atk')], [9, false, false, notDown('def')], [10, false, false, notDown('agi')], [11, false, false, notDown('spi')],
  [1, true, false, notUp('atk')],
  [2, true, false, () => null],                                                // 방어증가: 조건 칸이 비어 대상이 생기지 않는다 (원작 버그, 39cd)
  [3, true, false, notUp('agi')], [4, true, false, notUp('spi')],
]
const FALLBACK = new Set([0, 6, 5, 7])   // cs:4cfb

function casterPlan(units: Unit[], u: Unit, moves: Map<number, number>): AiPlan | null {
  const spots = [...moves.keys()].map(k => ({ x: k % 1000, y: Math.floor(k / 1000) }))
  const pick = (cap: number, effects: (e: number) => boolean) => {
    for (const [effect, own, desc, key] of CASTER_ORDER) {
      if (!effects(effect)) continue
      const m = spellsOf(u).find(s => s.effect === effect && s.fatigue > 0)
      if (!m || u.fatigue + m.fatigue > cap) continue
      const [, hi] = rules.spellRange(m)
      const side = units.filter(t => t.hp > 0 && (t.side === u.side) === own)
      const near = side.filter(t => dist(t, u) <= u.mov + hi)   // 이동력 + 사거리 범람 [근사: 지형 무시 거리]
      const keyed = (list: Unit[]) => list.flatMap(t => { const k = key(t); return k === null ? [] : [{ t, k }] })
      let found = keyed(near)
      if (!found.length && cap > 90) found = keyed(side)   // 4841: 걸어가기는 닿는 대상이 없으면 맵 전체
      if (!found.length) continue
      found.sort((a, b) => desc ? b.k - a.k : a.k - b.k)   // Array.sort 는 안정 정렬 = 원작 버블 정렬과 같은 순서
      return { m, targets: found.map(c => c.t) }
    }
    return null
  }
  const first = pick(90, () => true)
  if (first) {
    for (const t of first.targets) {
      const from = spots.filter(p => inSpellRange(rules, first.m, p, t))
        .sort((a, b) => dist(a, t) - dist(b, t) || dist(a, u) - dist(b, u))[0]   // 대상에서 가까운 칸부터 (대상 칸 범람 순서) [근사: 같으면 덜 움직임]
      if (from) return { unit: u, dest: from, magic: first.m, at: { x: t.x, y: t.y } }
    }
  }
  const walk = pick(100, e => FALLBACK.has(e))   // 4318: 피로 ≤ 100, 닿는 대상이 없으면 맵 전체에서
  if (!walk) return null
  const t = walk.targets[0]
  const dest = spots.sort((a, b) => dist(a, t) - dist(b, t) || dist(a, u) - dist(b, u))[0]
  return dest ? { unit: u, dest } : null
}
