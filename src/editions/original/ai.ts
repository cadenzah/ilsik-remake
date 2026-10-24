// 원작판 적 AI — 원작 그대로 [확정 2026-10-23, 역어셈블]. 개선판은 remake/ai.ts (점수식).
// 행동 여부는 원작 부대 상태(+0x235) [확정, 20ec:a419]:
//   0 행동 · 1 경계 대기 (일행이 닿으면 또는 맞으면 0) · 2 대기 (장 이벤트로만 풀림) · 3 행동, 이동력 0 · 4 숨김 — aiGate (두 판 공통)
// 행동: 공격 유형 1 (마법 직업, 직업 8~14) = casterPlan (124e:284a, 물리 공격 없음), 그 밖 = physicalPlan (124e:4d43). 세부는 rules.md "원작 AI"
import type { StageMap } from '../../core/data'
import type { AiPlan } from '../../core/edition'
import { DIRS, dist, inside, key, moveCost, reachable } from '../../core/grid'
import { attackKind, canAim, inReach, strikeArea } from '../../core/attack'
import type { Pos, Unit } from '../../core/unit'
import { inSpellRange, spellsOf } from '../../core/magic'
import { k2, k4, rules } from './rules'

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

/** 두 판 공통 앞부분 [확정]: 부대 상태 1 깨어남·1/2 대기, 피로 > 70 또는 HP ¼ 이하 휴식. 행동하면 null */
export function aiGate(map: StageMap, units: Unit[], u: Unit, troopState: number[]): AiPlan | null {
  const stay = { unit: u, dest: { x: u.x, y: u.y } }
  // 깨어난 그 차례는 휴식 판정 없이 바로 행동 (a7b9)
  if (troopState[u.troop] === 1 && partyInReach(map, units, u)) { troopState[u.troop] = 0; return null }
  if (troopState[u.troop] === 1 || troopState[u.troop] === 2) return stay
  // 20ec:abe1: 피로 > 70 이거나 HP ≤ 최대HP × 0.25 ([0x1f3f]) 면 휴식 (038e) 하고 차례 끝
  if (u.fatigue > 70 || u.hp <= u.maxHp * 0.25) return { ...stay, rest: true }
  return null
}

/** 원작판 AI: 2ff8:1480 — 공격 유형 1 (마법 직업) 은 124e:284a (casterPlan), 그 밖은 124e:4d43 (physicalPlan) */
export function planFor(map: StageMap, units: Unit[], u: Unit, troopState: number[]): AiPlan {
  const gate = aiGate(map, units, u, troopState)
  if (gate) return gate
  const moves = reachable(map, units, u)
  const plan = attackKind(u) === 1 ? casterPlan(units, u, moves) : physicalPlan(units, u, moves)
  return plan ?? { unit: u, dest: { x: u.x, y: u.y } }
}

// ---------- 원작 물리 AI (124e:4d43) [확정 2026-10-23, 역어셈블] ----------
// 대상 = 이동력 + 사거리 + 범위 범람 (35ae:1253) 안의 상대편, 키 오름차순 (0aa2:0327): 생명 div 최대생명 = 0 (조금이라도 다침) 이면 0,
//   아니면 k2 물리 방어력 → 다친 대상 먼저, 다음은 방어 약한 순 (4ef9~4f8e, 284a 와 같은 정수 나눗셈).
// 공격 유형별 (cs:67ab): 0 단일 = 대상 순서대로, 덜 움직이는 칸 (자기 이동 범람 순) 중 그 대상이 사거리에 드는 첫 칸 (564e).
//   2 기사 (사거리 0·범위 1 로 둠, 4dba) = 대상 둘레 1 안의 이동 칸마다 둘레 적 수를 세어 가장 많은 칸 (576e), 중심 = 자기.
//   3 포수 = 대상 둘레 1 의 (적 수 − 같은 편 수) 로 대상을 다시 내림차순 (596e) 뒤 궁수와 같게.
//   4 궁수·5 추전수 = 대상 순서대로, 대상에서 먼 칸부터 (대상 범람 역순) 대상과 같은 행·열인 이동 칸 (5ac4) — 멀리서 쏜다.
// 칠 대상이 없으면 이동력 2배 범람 안의 상대 → 없으면 상대 모두, 같은 키로 정렬해 첫 대상 쪽으로 이동력만큼 걷기 (625c~6708).
// 웹 근사: 범람 = 맨해튼 거리, 자기 이동 범람 순 = 이동 칸까지 거리 순 (같으면 찾은 순), 대상 범람 역순 = 대상과 먼 순
const k2Key = (t: Unit) => Math.floor(t.hp / Math.max(1, t.maxHp)) === 0 ? 0 : k2(t)
const byKey = (list: Unit[]) => list.map(t => ({ t, k: k2Key(t) })).sort((a, b) => a.k - b.k).map(c => c.t)   // 안정 정렬

function physicalPlan(units: Unit[], u: Unit, moves: Map<number, number>): AiPlan | null {
  const kind = attackKind(u)
  const spots = [...moves.keys()].map(k => ({ x: k % 1000, y: Math.floor(k / 1000) })).sort((a, b) => dist(a, u) - dist(b, u))
  const foes = units.filter(o => o.hp > 0 && o.side !== u.side)
  const reach = u.mov + (kind === 2 ? 0 : u.range[1]) + strikeArea(u)
  let targets = byKey(foes.filter(t => dist(t, u) <= reach))
  if (targets.length) {
    if (kind === 2) {   // 기사: 둘레 적이 가장 많은 칸 (같으면 앞선 칸)
      let best: { spot: Pos; n: number } | null = null
      for (const spot of spots) {
        if (!targets.some(t => dist(t, spot) <= 1)) continue
        const n = foes.filter(t => dist(t, spot) <= 1).length
        if (!best || n > best.n) best = { spot, n }
      }
      if (best) return { unit: u, dest: best.spot, target: u }
    } else {
      if (kind === 3) {   // 포수: 대상 둘레 (적 − 같은 편) 많은 순
        const net = (t: Unit) => units.filter(o => o.hp > 0 && o !== u && dist(o, t) <= 1).reduce((n, o) => n + (o.side === u.side ? -1 : 1), 0)
        targets = targets.map(t => ({ t, n: net(t) })).sort((a, b) => b.n - a.n).map(c => c.t)
      }
      for (const t of targets) {
        const ok = spots.filter(p => inReach(u, p, t) && canAim(u, t, p, units))
        const from = kind >= 3 ? ok.sort((a, b) => dist(b, t) - dist(a, t))[0] : ok[0]   // 궁수·추전수·포수 = 대상에서 먼 칸, 단일 = 덜 움직이는 칸
        if (from) return { unit: u, dest: from, target: t }
      }
    }
  }
  const near = byKey(foes.filter(t => dist(t, u) <= u.mov * 2))   // 걸어가기 (625c): 이동력 2배 안 → 없으면 모두
  const goal = near[0] ?? byKey(foes)[0]
  if (!goal) return null
  const dest = spots.slice().sort((a, b) => dist(a, goal) - dist(b, goal) || dist(a, u) - dist(b, u))[0]
  return dest ? { unit: u, dest } : null
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
  [2, true, false, notUp('def')],                                               // 방어증가: 원작은 조건 칸이 비어 대상이 생기지 않는다 (원작 버그, 39cd) — 다른 증가처럼 고침
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
