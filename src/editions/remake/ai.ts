// 개선판 적 AI — 점수식. 부대 상태·휴식은 원작과 같은 규칙 (original/ai.ts aiGate).
// 갈 수 있는 칸 × 칠 수 있는 중심을 모두 점수로 매겨 가장 큰 것: 물리 = 예상 피해 중간값 − 방어 × 0.1, 처치 +1000,
//   범위 공격 (기사·포수) 은 맞는 적 합, 같은 편이 맞으면 1.5배로 빼고 남는 게 있을 때만. 같으면 덜 움직이는 칸.
//   근접은 반격을 계산한다 (제안 3): 되받아 쓰러질 공격은 안 하고, 반격 피해의 절반을 뺀다.
// 마법 직업 (공격 유형 1) 은 쓸 수 있는 마법 × 칸 × 중심도 점수로 매겨 물리보다 크면 마법 (spellScore).
// 칠 게 없으면 가장 가까운 상대 쪽으로. 원작 AI 와의 차이는 rules.md "마법 직업 AI"·"물리 AI"
// 성향 (B1 제안 10, 컴퓨터 유닛만 — 시뮬레이터 플레이어도 이 planFor 를 쓰므로 부대 0 은 늘 돌격):
//   돌격 = 위 그대로 · 자리 지킴 (보스 기본) = 이번 차례에 칠 수 있을 때만 움직인다 · 무리 (적 기본) = 칠 게 없으면 부대에서 앞서지 않게 진격,
//   부대 누가 한 번 싸우면 풀린다. 휴식선이면 일행이 다음 차례에 닿지 않는 칸으로 물러나 쉰다 (자리 지킴은 제자리).
//   회복·강화 마법을 쓰는 상대를 칠 때 점수 ×1.3. 장별 덮어쓰기 = tune.json "ai" { "부대" 또는 "부대.대원": 성향 }
import type { Magic, Member, StageMap } from '../../core/data'
import type { AiPlan } from '../../core/edition'
import { dist, key, reachable } from '../../core/grid'
import { aimsFrom, reachCells, strikeTargets } from '../../core/attack'
import { aiCaster, spellCenters, spellTargets, spellsOf } from '../../core/magic'
import type { Pos, Unit } from '../../core/unit'
import { aiGate } from '../original/ai'
import { counterDamage, stageTune } from '../../core/battleCore'
import { S } from '../../core/state'

const rules = () => S.ed.rules   // 지금 판의 규칙 (개선판 피해식, tools/sim 이 바꾼 식)

export type Mind = 'charge' | 'hold' | 'pack'
export const MIND_NAME: Record<Mind, string> = { charge: '돌격', hold: '자리 지킴', pack: '무리' }
/** 시뮬레이터가 바꿔 비교한다 (--mind 성향 하나로 고정, --retreat no, --backer 배율) */
export const mindOpts: { all?: Mind; retreat: boolean; backer: number } = { retreat: true, backer: 1.3 }
const isBoss = (u: Unit) => S.cond.some(r => 'dead' in r.if && !r.do.includes('lose') && r.if.dead.some(([t, m]: Member) => t === u.troop && m === u.member))

/** 컴퓨터 유닛의 성향. 일행은 늘 돌격 (성향 없음) */
export function mindOf(u: Unit): Mind {
  if (u.troop === 0) return 'charge'
  if (mindOpts.all) return mindOpts.all
  const set = stageTune()?.ai
  const v = set?.[`${u.troop}.${u.member}`] ?? set?.[String(u.troop)]
  if (v) return v
  if (isBoss(u)) return 'hold'
  return u.side === 'enemy' ? 'pack' : 'charge'
}

/** 카드 한 줄: 자리 지킴 (닿는 상대만 친다)·무리 (아직 싸움 전, 부대와 발을 맞춰 온다) 만. 돌격은 따로 적지 않는다 */
export function mindNote(u: Unit): string {
  const m = mindOf(u)
  if (m === 'hold') return '자리 지킴'
  if (m === 'pack' && !engagedOf(S.troopState).has(u.troop) && !hurt(S.units.filter(o => o.hp > 0 && o.troop === u.troop && o.side === u.side)))
    return '무리'
  return ''
}

// 무리: 맞은 대원이 있으면 이미 싸움. 자리 지키는 보스는 전투 시작 처리로 생명이 깎인 채 나오기도 해 뺀다
const hurt = (us: Unit[]) => us.some(o => mindOf(o) !== 'hold' && o.hp < o.maxHp)

// 무리: 부대 누가 싸움에 들어갔나 (troopState 배열은 전투마다 새로 만든다)
const engaged = new WeakMap<number[], Set<number>>()
const engagedOf = (ts: number[]) => engaged.get(ts) ?? (engaged.set(ts, new Set()), engaged.get(ts)!)
const PACK = 2   // 부대 평균보다 이만큼까지만 앞선다

export function planFor(map: StageMap, units: Unit[], u: Unit, troopState: number[]): AiPlan {
  const gate = aiGate(map, units, u, troopState)
  const mind = mindOf(u)
  if (gate?.rest && mindOpts.retreat && u.troop !== 0 && mind !== 'hold' && troopState[u.troop] !== 3) return { ...gate, dest: retreat(map, units, u) }
  if (gate) return gate
  const plan = choose(map, units, u)
  if (plan.target || plan.magic) {   // 상대를 치면 그 부대는 싸움에 들어간다 (자기편 회복·강화는 아님)
    if (u.troop !== 0 && (plan.target || (plan.magic && rules().spellSide(plan.magic) === 'foe'))) engagedOf(troopState).add(u.troop)
    return plan
  }
  if (mind === 'hold') return { unit: u, dest: { x: u.x, y: u.y } }
  if (mind === 'pack' && !engagedOf(troopState).has(u.troop)) return packStep(map, units, u, troopState, plan)
  return plan
}

function choose(map: StageMap, units: Unit[], u: Unit): AiPlan {
  const foes = units.filter(o => o.hp > 0 && o.side !== u.side)
  const moves = reachable(map, units, u)
  const backer = (t: Unit) => u.troop !== 0 && supports(t) ? mindOpts.backer : 1   // 회복·강화 담당 먼저
  let best: AiPlan | null = null
  let bestScore = -Infinity
  for (const k of moves.keys()) {
    const spot = { x: k % 1000, y: Math.floor(k / 1000) }
    for (const c of aimsFrom(u, spot, units)) {
      const back = counterDamage(u, c, spot)   // 되받아 쓰러질 공격은 안 하고, 반격 피해는 절반만큼 뺀다
      if (back >= u.hp) continue
      let score = -dist(spot, u) * 0.01 - back * 0.5, own = 0   // 같으면 이동이 적은 칸
      for (const t of strikeTargets(u, c, spot, units)) {
        const [lo, hi] = rules().damageRange(map, u, t, spot)
        const v = (lo >= t.hp ? 1000 : 0) + (lo + hi) / 2 - t.def * 0.1
        if (t.side === u.side) { own++; score -= 1.5 * Math.max(1, v) } else score += v * backer(t)
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
  if (!nearest) return { unit: u, dest: { x: u.x, y: u.y } }
  let dest: Pos = { x: u.x, y: u.y }
  for (const k of moves.keys()) {
    const p = { x: k % 1000, y: Math.floor(k / 1000) }
    if (dist(p, nearest) < dist(dest, nearest)) dest = p
  }
  return { unit: u, dest }
}

/** 회복·강화처럼 자기편에 거는 마법을 쓸 수 있는 유닛 */
const supports = (t: Unit) => spellsOf(t).some(m => rules().spellSide(m) === 'own' && rules().canCast(t, m))

/** 무리: 가장 가까운 상대 쪽으로 가되, 부대 (움직이는 같은 부대 대원) 의 그 상대까지 평균 거리보다 PACK 넘게 앞서지 않는 칸 중 가장 가까운 칸 */
function packStep(map: StageMap, units: Unit[], u: Unit, troopState: number[], plan: AiPlan): AiPlan {
  const kin = units.filter(o => o.hp > 0 && o.troop === u.troop && o.side === u.side)
  const mates = kin.filter(o => mindOf(o) === 'pack')   // 자리 지키는 보스는 빼고
  const foe = units.filter(o => o.hp > 0 && o.side !== u.side).sort((a, b) => dist(a, u) - dist(b, u))[0]
  if (mates.length < 3 || !foe || hurt(kin)) { engagedOf(troopState).add(u.troop); return plan }   // 맞은 대원이 있으면 이미 싸움
  const line = mates.reduce((a, o) => a + dist(o, foe), 0) / mates.length - PACK
  if (dist(plan.dest, foe) >= line) return plan
  let dest: Pos = { x: u.x, y: u.y }
  if (dist(dest, foe) < line) return { unit: u, dest }   // 이미 앞섰으면 기다린다
  for (const k of reachable(map, units, u).keys()) {
    const p = { x: k % 1000, y: Math.floor(k / 1000) }, d = dist(p, foe)
    if (d >= line && d < dist(dest, foe)) dest = p
  }
  return { unit: u, dest }
}

/** 물러나 쉴 칸: 상대가 다음 차례에 칠 수 있는 칸 (이동 + 사거리, 공격 마법은 사거리 + 범위) 밖에서 덜 움직이는 칸. 없으면 제자리 */
function retreat(map: StageMap, units: Unit[], u: Unit): Pos {
  const danger = new Set<number>()
  for (const e of units.filter(o => o.hp > 0 && o.side !== u.side)) {
    const reach = Math.max(0, ...spellsOf(e).filter(m => rules().spellSide(m) === 'foe' && rules().canCast(e, m)).map(m => m.range + m.area))
    for (const k of reachable(map, units, e).keys()) {
      const x = k % 1000, y = Math.floor(k / 1000)
      reachCells(e, { x, y }, danger)
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++) if (Math.abs(dx) + Math.abs(dy) <= reach) danger.add(key(x + dx, y + dy))
    }
  }
  if (!danger.has(key(u.x, u.y))) return { x: u.x, y: u.y }
  let best: Pos | null = null, cost = Infinity
  for (const [k, c] of reachable(map, units, u)) if (!danger.has(k) && c < cost) { cost = c; best = { x: k % 1000, y: Math.floor(k / 1000) } }
  return best ?? { x: u.x, y: u.y }
}

/** 마법 점수: 피해 합 (처치 +1000), 회복은 잃은 생명이 30% 넘는 대상만, 강화·약화·중독·혼수는 아직 안 걸린 대상만.
 *  같으면 덜 움직이는 자리. 점수 0 이하면 쓰지 않는다 */
function spellScore(units: Unit[], u: Unit, m: Magic, c: Pos, from: Pos): number {
  let score = 0
  for (const t of spellTargets(rules(), u, m, c, units, from)) {
    const h = rules().spell(u, t, m)
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
    if (!rules().canCast(u, m)) continue
    for (const k of moves.keys()) {
      const from = { x: k % 1000, y: Math.floor(k / 1000) }
      for (const c of spellCenters(rules(), u, m, units, from)) {
        const score = spellScore(units, u, m, c, from) - dist(from, u) * 0.01
        if (score > 0.5 && score > (best?.score ?? -Infinity)) best = { plan: { unit: u, dest: from, magic: m, at: c }, score }
      }
    }
  }
  return best
}
