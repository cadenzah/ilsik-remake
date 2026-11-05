// 개선판 적 AI — 점수식. 부대 상태·휴식은 원작과 같은 규칙 (original/ai.ts aiGate).
// 갈 수 있는 칸 × 칠 수 있는 중심을 모두 점수로 매겨 가장 큰 것: 물리 = 예상 피해 중간값 − 방어 × 0.1, 처치 +1000,
//   범위 공격 (기사·포수) 은 맞는 적 합, 같은 편이 맞으면 1.5배로 빼고 남는 게 있을 때만. 같으면 덜 움직이는 칸.
//   근접은 반격을 계산한다 (제안 3): 되받아 쓰러질 공격은 안 하고, 반격 피해의 절반을 뺀다.
// 마법 직업 (공격 유형 1) 은 쓸 수 있는 마법 × 칸 × 중심도 점수로 매겨 물리보다 크면 마법 (spellScore).
// 칠 게 없으면 가장 가까운 상대 쪽으로. 원작 AI 와의 차이는 rules.md "마법 직업 AI"·"물리 AI"
import type { Magic, StageMap } from '../../core/data'
import type { AiPlan } from '../../core/edition'
import { dist, reachable } from '../../core/grid'
import { aimsFrom, strikeTargets } from '../../core/attack'
import { aiCaster, spellCenters, spellTargets, spellsOf } from '../../core/magic'
import type { Pos, Unit } from '../../core/unit'
import { aiGate } from '../original/ai'
import { counterDamage } from '../../core/battleCore'
import { S } from '../../core/state'

const rules = () => S.ed.rules   // 지금 판의 규칙 (개선판 피해식, tools/sim 이 바꾼 식)

export function planFor(map: StageMap, units: Unit[], u: Unit, troopState: number[]): AiPlan {
  const gate = aiGate(map, units, u, troopState)
  if (gate) return gate
  const foes = units.filter(o => o.hp > 0 && o.side !== u.side)
  const moves = reachable(map, units, u)
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
  if (!nearest) return { unit: u, dest: { x: u.x, y: u.y } }
  let dest: Pos = { x: u.x, y: u.y }
  for (const k of moves.keys()) {
    const p = { x: k % 1000, y: Math.floor(k / 1000) }
    if (dist(p, nearest) < dist(dest, nearest)) dest = p
  }
  return { unit: u, dest }
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
