// 밸런스 시뮬레이터 본체 (B1 제안 8, 실행 = tools/sim.mjs). 루트 하나를 1장부터 이어 돌린다:
// 출전 고르기 → 전투 (아군도 개선판 점수식 AI, 적·NPC 는 판 AI) → 경험치·레벨업 → 전투 후 합류·이탈·소지품 → 다음 장.
// 전투 규칙은 src/core/battleCore.ts 를 그대로 쓰고, 차례 진행은 battle.ts runRounds·aiSteps·tickUnit·finishUnit 을 연출 없이 따른다.
// 웹과 다른 점 (근사): 정비 화면에서 장비를 갈아 끼우지 않는다 (레벨업 승급만), 숨은 장 없음, 대사·연출 없음, 진로는 --route
import { loadBattles, loadDialogue, loadScenes, loadTables, type Battles, type Magic, type StageMap } from '../../src/core/data'
import type { AiPlan, Edition } from '../../src/core/edition'
import { EQUIP, GOLD, ITEMS, PARTY, finishStage, giveGold, nextStage, partyType, promoteDeployed, restore, snapshot, type Camp } from '../../src/core/campaign'
import { addExp, again, freshBattle, judge, placements, rest, spellResult, startEvents, strike, takeTreasure, tire, treasureAt, turnStart, type Outcome } from '../../src/core/battleCore'
import { DIRS, dist, inside, key, moveCost, pathTo, reachable } from '../../src/core/grid'
import { aimsFrom, inReach, strikeTargets } from '../../src/core/attack'
import { aiCaster, spellsOf } from '../../src/core/magic'
import { blocksAt, chapter, initScript, ownsSteps, runSteps } from '../../src/core/script'
import { canEquip } from '../../src/core/camp'
import { stageDef } from '../../src/core/stage'
import { S, member } from '../../src/core/state'
import type { Unit } from '../../src/core/unit'
import { edition as original } from '../../src/editions/original'
import { edition as remake, tuning as remakeTuning } from '../../src/editions/remake'
import { planFor as smartPlan } from '../../src/editions/remake/ai'
import { ORIGINAL, makeRules, type Tuning } from '../../src/editions/original/rules'

declare const process: { env: Record<string, string | undefined> }   // node (tools/sim.mjs) — @types/node 없이

interface Opts { until?: number; ed: Edition; routes: number[]; seed: number; pick: 'level' | 'front'; book: boolean; tools: boolean; turns: number; retry: number; push: boolean; json: boolean; dmg: string; careful: 'lead' | 'all' | 'none' }
let careful: Opts['careful'] = 'all'

/** 장 하나의 기록 */
interface Row {
  n: number; route: number; result: Outcome | 'stall'; tries: number; turns: number
  lostBy?: string                                            // 진 까닭 = 쓰러져 패배가 된 대원 (선두 또는 지켜야 할 NPC), 정체는 없음
  pushed?: boolean                                           // 지고도 이어 감 (--push): 마지막 시도의 성장으로 다음 장
  deployed: number; partyLv: number; partyMax: number; allLv: number; minLv: number;   // allLv·minLv = 일행 전체 (대기 포함) 평균·최저 레벨
  foes: number; foeLv: number; foeMax: number
  fallen: string[]; npcFallen: number; leadLow: number      // leadLow = 선두 HP 최저 (%)
  leadEarly: boolean                                         // 첫 아군 차례 전에 선두가 쓰러짐
  foeRests: number; foeActs: number; allyRests: number; levelUps: number; joined: string[]
  hits: Sides<Hits>; mag: Sides<Hits>; heal: Sides<number>   // 물리·마법 타격 분포, 회복량 합 (아군 쪽 = 일행·NPC)
}

// ---------- 난수 (레벨업만 쓴다): 씨앗을 정해 같은 결과 ----------
function seedRandom(seed: number) {
  let a = seed >>> 0
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TEMPLE = 40, MAPS = [175, 176, 177, 178], ATH = 8, UNKNOWN_BOOK = 174
const aliveMember = (t: number, m: number) => (member([t, m])?.hp ?? 0) > 0
const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : 0

/** 출전 고르기: 선두 (일행 0) 는 늘, 나머지는 level = 레벨 높은 순 (같으면 일행 순서), front = 앞에서부터 (정비 화면 기본) */
function pickDeploy(max: number, how: Opts['pick']) {
  const rest = PARTY.map((_, i) => i).slice(1)
  if (how === 'level') rest.sort((a, b) => partyType(PARTY[b]).lv - partyType(PARTY[a]).lv || a - b)
  return [0, ...rest.slice(0, max - 1)].sort((a, b) => a - b)
}

/** 미지의책: 소지품에 있고 애슬이 일행에 있으면 도구 칸에 끼운다 (전직은 promoteDeployed) */
function equipBook() {
  const i = ITEMS.indexOf(UNKNOWN_BOOK), ath = PARTY.find(t => S.types[t].por === ATH)
  if (i < 0 || ath === undefined) return
  const e = partyType(ath).equip
  EQUIP.set(ath, [e[0], e[1], UNKNOWN_BOOK])
  ITEMS.splice(i, 1)
}

/** 도구 칸: 출전 대원마다 소지품 중 능력치 보탬이 가장 큰 쓸 수 있는 도구로 (정비 화면에서 바꿀 수 있는 건 도구뿐, camp.ts canEquip).
 *  점수 = 생명·역량·방어·정신·민첩 1, 이동 3 (감소는 뺀다). 미지의책은 equipBook 이 */
function equipTools() {
  const W = [0, 1, 1, 1, 1, 0, 3, 1, 0]   // 능력치 번호 (unit.ts equippedStats)
  const score = (id: number) => {
    const it = S.tables.items.get(id)
    return it ? [it.stat, it.stat2].reduce((a, [n, v]) => a + (n > 8 ? -W[n - 8] * v : W[n] * v), 0) : 0
  }
  for (const i of S.deploy) {
    const t = partyType(PARTY[i])
    let best = -1
    for (const [k, id] of ITEMS.entries()) {
      if (id === UNKNOWN_BOOK || !canEquip(t, S.tables.items.get(id)) || score(id) <= score(t.equip[2])) continue
      if (best < 0 || score(id) > score(ITEMS[best])) best = k
    }
    if (best < 0) continue
    const [id] = ITEMS.splice(best, 1)
    if (t.equip[2]) ITEMS.push(t.equip[2])
    EQUIP.set(PARTY[i], [t.equip[0], t.equip[1], id])
  }
}

// ---------- 아군 조종 (플레이어 대신) ----------

/** 걸어서 가는 거리 (지형만, 유닛 무시) 로 가장 가까운 상대 쪽 칸. 개선판 AI 의 "가장 가까운 상대 쪽" 은 맨해튼 거리라 강·벽 뒤에서 막힌다 */
function approach(u: Unit, goals?: { x: number; y: number }[]): AiPlan | null {
  const far = new Map<number, number>(), todo: [number, number][] = []
  for (const o of goals ?? S.units.filter(o => o.hp > 0 && o.side !== u.side)) { far.set(key(o.x, o.y), 0); todo.push([o.x, o.y]) }
  for (let i = 0; i < todo.length; i++) {
    const [x, y] = todo[i], d = far.get(key(x, y))!
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy
      if (!inside(S.map, nx, ny) || far.has(key(nx, ny)) || moveCost(S.map, nx, ny, u.type.moveKind) === Infinity) continue
      far.set(key(nx, ny), d + 1)
      todo.push([nx, ny])
    }
  }
  let best: number | null = null
  for (const k of reachable(S.map, S.units, u).keys()) if (far.has(k) && (best === null || far.get(k)! < far.get(best)!)) best = k
  return best === null || best === key(u.x, u.y) ? null : { unit: u, dest: { x: best % 1000, y: Math.floor(best / 1000) } }
}

/** 다음 적 차례에 그 칸에서 받을 수 있는 가장 큰 물리 피해 합 (적마다 지금 자리에서 걸어 닿아 칠 수 있으면 최대 피해). 마법은 뺀다 (근사).
 *  gone = 이번 행동으로 쓰러뜨릴 적 */
function danger(u: Unit, at: { x: number; y: number }, gone?: Unit) {
  const ox = u.x, oy = u.y
  u.x = at.x; u.y = at.y
  let sum = 0
  for (const e of S.units) {
    if (e.hp <= 0 || e.side === u.side || e === gone || S.troopState[e.troop] >= 2) continue
    if (dist(e, at) > e.mov + e.range[1] + 1) continue
    const moves = reachable(S.map, S.units, e)
    let can = false
    for (const k of moves.keys()) if (inReach(e, { x: k % 1000, y: Math.floor(k / 1000) }, at)) { can = true; break }
    let worst = can ? S.ed.rules.damageRange(S.map, e, u)[1] : 0
    if (aiCaster(e)) for (const m of spellsOf(e)) {   // 걸어 가서 마법: 이동력 + 마법 거리 + 범위 안이면 그 마법 피해
      if (S.ed.rules.spellSide(m) !== 'foe' || !S.ed.rules.canCast(e, m) || dist(e, at) > e.mov + S.ed.rules.spellRange(m)[1] + m.area) continue
      const h = S.ed.rules.spell(e, u, m)
      if (h.kind === 'hp') worst = Math.max(worst, h.value)
    }
    sum += worst
  }
  u.x = ox; u.y = oy
  return sum
}

/** 조심하는 대원 (--careful): 다음 적 차례 피해 (danger) × 1.5 가 HP 보다 작은 칸만 (행동 뒤 피로로 방어가 떨어지는 몫).
 *  계획한 칸이 위험하면 안전한 칸 중 가장 아프게 치는 칸 → 없으면 상대에 가장 가까운 안전한 칸 → 없으면 가장 덜 위험한 칸 (제자리면 휴식).
 *  HP 절반 아래면 쓰러뜨릴 수 있을 때만 치고, 아니면 물러나 쉰다 */
function safer(u: Unit, p: AiPlan): AiPlan {
  const lead = u.troop === 0 && u.member === 0
  const safe = (risk: number) => risk * (lead ? LEAD_CARE : 1.5) < u.hp   // 선두가 쓰러지면 패배라 사람은 더 뒤에 둔다
  const kill = p.target && S.ed.rules.damageRange(S.map, u, p.target, p.dest)[0] >= p.target.hp ? p.target : undefined
  const low = u.hp < u.maxHp * 0.5
  if (process.env.SIM_DEBUG && S.turn <= Number(process.env.SIM_DEBUG) && (!process.env.SIM_CH || S.def.n === Number(process.env.SIM_CH))) console.log('  wary', S.turn, u.type.name, u.hp, '/', u.maxHp, 'dest', [p.dest.x, p.dest.y], 'danger', danger(u, p.dest, kill), 'fat', u.fatigue)
  if (p.rest || ((!low || kill) && safe(danger(u, p.dest, kill)))) return p
  let best: { plan: AiPlan; dmg: number; risk: number } | null = null, calm: { plan: AiPlan; risk: number } | null = null
  for (const k of reachable(S.map, S.units, u).keys()) {
    const spot = { x: k % 1000, y: Math.floor(k / 1000) }
    const risk = danger(u, spot)
    if (!calm || risk < calm.risk || (risk === calm.risk && spot.x === u.x && spot.y === u.y)) calm = { plan: { unit: u, dest: spot }, risk }
    if (!safe(risk) || low) continue
    for (const c of aimsFrom(u, spot)) {
      const dmg = strikeTargets(u, c, spot).reduce((a, t) => a + (t.side !== u.side ? S.ed.rules.damageRange(S.map, u, t, spot)[0] : 0), 0)
      if (!best || dmg > best.dmg || (dmg === best.dmg && risk < best.risk)) best = { plan: { unit: u, dest: spot, target: c }, dmg, risk }
    }
  }
  if (best) return best.plan
  if (!low && calm && safe(calm.risk)) {
    const a = approach(u)
    if (a && safe(danger(u, a.dest))) return a
  }
  return calm && (calm.plan.dest.x !== u.x || calm.plan.dest.y !== u.y) ? calm.plan : { unit: u, dest: { x: u.x, y: u.y }, rest: true }
}

/** 일행 대원의 행동: 개선판 점수식 AI. 칠 것도 쉴 까닭도 없으면 걸어서 가까운 상대 쪽으로. 조심하는 대원은 safer */
function partyPlan(u: Unit): AiPlan {
  // 도착 승리 장 (36·37장): 선두는 목표 칸으로. 이번 차례에 닿으면 위험해도 간다 (닿는 순간 승리)
  const goal = u.member === 0 ? S.cond.find(c => 'reach' in c.if && (c.do.includes('win') || c.do.includes('ending')))?.if : undefined
  if (goal && 'reach' in goal) {
    const at = { x: goal.reach[0], y: goal.reach[1] }, go = approach(u, [at])
    if (go && go.dest.x === at.x && go.dest.y === at.y) return go
    if (go) return safer(u, go)
  }
  let p = smartPlan(S.map, S.units, u, S.troopState)
  if (!p.rest && !p.target && !p.magic) p = approach(u) ?? p
  // 사람은 싸움이 몇 턴 동안 진척이 없으면 들어간다 (43장 2단계: 적은 벽 뒤에서 안 오고, 조심하는 일행은 사거리 앞에서 마법만 쏘며 60턴 정체)
  const wary = S.turn - lastFight < QUIET && (careful === 'all' || (careful === 'lead' && u.member === 0))
  return wary ? safer(u, p) : p
}

// ---------- 전투 한 판 ----------

/** 타격 분포 (물리·생명상해 따로): n 타격 수, one = 1 피해 (대상 HP 가 1 보다 많을 때), half = 최대HP 절반 이상 한 방, sum = 피해 ÷ 최대HP 합 (평균 = 한 방이 최대HP 의 몇 %) */
interface Hits { n: number; one: number; half: number; sum: number; pts: number }   // pts = 피해 합
const noHits = (): Hits => ({ n: 0, one: 0, half: 0, sum: 0, pts: 0 })
type Sides<T> = { ally: T; foe: T }
interface Tally { hits: Sides<Hits>; mag: Sides<Hits>; heal: Sides<number>; foeRests: number; foeActs: number; allyRests: number; levelUps: number; leadLow: number; leadEarly: boolean; allyMoved: boolean }

function tallyHits(h: Hits, u: Unit, hits: { target: Unit; value: number }[], before: Map<Unit, number>) {
  for (const { target, value } of hits) {
    if (target.side === u.side) continue
    if (target.hp <= 0) lastFight = S.turn
    h.n++
    h.pts += value
    if (value === 1 && (before.get(target) ?? 0) > 1) h.one++
    if (value >= target.maxHp * 0.5) h.half++
    h.sum += value / target.maxHp
  }
}

const LEAD_CARE = Number(process.env.SIM_LEAD ?? 2.5)   // 선두의 조심 배수 (다른 대원 1.5)
const costs = process.env.SIM_COST !== 'no'   // 쓰러진 대가 (제안 12). SIM_COST=no 로 끄고 비교
const QUIET = 6   // 이만큼 아무도 안 쓰러지는 턴이 이어지면 조심을 풀고 들어간다
let lastFight = 0   // 마지막으로 누가 쓰러진 턴

/** 행동 하나 (battle.ts aiAct·finishUnit). party = 일행 → 개선판 점수식 AI 로 고르고, 행동을 마친 칸의 보물을 줍는다. 전투가 끝나면 결과 */
function act(u: Unit, party: boolean, t: Tally): Outcome | null {
  const plan: AiPlan = party ? partyPlan(u) : S.ed.planFor(S.map, S.units, u, S.troopState)
  if (plan.rest) {
    if (party) t.allyRests++
    else if (u.fatigue > 70 || u.hp <= u.maxHp * 0.25) t.foeRests++   // 원작 AI 휴식선 (aiGate). 경계·대기 부대의 제자리는 세지 않는다
    rest(u)
    if (party && !S.ed.features.autoRest) tire(u, false)   // 원작판 「휴식」: rest 뒤 finishUnit → tire
    return judge().result
  }
  if (!party) t.foeActs++
  if (process.env.SIM_DEBUG && S.turn <= Number(process.env.SIM_DEBUG) && (!process.env.SIM_CH || S.def.n === Number(process.env.SIM_CH))) console.log('  plan', S.turn, u.type.name, u.troop, [u.x, u.y], '->', [plan.dest.x, plan.dest.y], plan.target?.type.name, plan.magic?.name, 'mov', u.mov, 'troop', S.troopState[u.troop])
  const path = pathTo(reachable(S.map, S.units, u), plan.dest.x, plan.dest.y)
  if (path.length > 1) { u.moved = true; u.steps += path.length - 1; u.x = plan.dest.x; u.y = plan.dest.y }
  let attacked = false, magic: Magic | undefined
  if (plan.magic && plan.at) {
    const before = new Map(S.units.map(o => [o, o.hp]))
    const r = spellResult(u, plan.magic, plan.at)
    const side = u.side === 'enemy' ? 'foe' : 'ally'
    if (S.ed.rules.spellSide(plan.magic) === 'foe') tallyHits(t.mag[side], u, r.hits.filter(h => h.value > 0), before)
    else t.heal[side] += r.hits.reduce((a, h) => a + h.value, 0)
    if (addExp(u, r.hits, plan.magic, r.cured)) t.levelUps++
    magic = plan.magic
  } else if (plan.target && plan.target.hp > 0) {
    const before = new Map(S.units.map(o => [o, o.hp]))
    const r = strike(u, plan.target)
    tallyHits(u.side === 'enemy' ? t.hits.foe : t.hits.ally, u, r.hits, before)
    if (addExp(u, r.hits)) t.levelUps++
    attacked = true
  }
  if (party && S.ed.features.autoRest && !attacked && !magic && !u.moved) { rest(u); t.allyRests++ }
  else tire(u, attacked, magic)
  if (party) for (const [i] of treasureAt(u)) takeTreasure(i)
  S.floats.length = 0
  return judge().result
}

/** 차례 시작 (battle.ts tickUnit): 'skip' = 혼수·사망, 그 밖은 전투 결과 또는 null */
function tick(u: Unit): Outcome | 'skip' | null {
  if (u.ticked) return u.acted ? 'skip' : null
  u.ticked = true
  const r = S.ed.rules.statusTick(u)
  if (r.poison) { const end = judge().result; if (end) return end }
  if (u.hp <= 0) return 'skip'
  if (r.coma) { rest(u); u.acted = true; return 'skip' }
  return null
}

/** 일행 단계: 칠 수 있는 대원부터 (battle.ts firstToMove 와 같은 생각), 한 명씩 행동. 두 번 행동 (혜유) 포함 */
function partyStep(live: Unit[], t: Tally): Outcome | null {
  for (;;) {
    const left = live.filter(u => u.hp > 0 && !u.acted && S.units.includes(u))
    if (!left.length) return null
    const ready = left.find(u => { const p = smartPlan(S.map, S.units, u, [...S.troopState]); return !!(p.target || p.magic) }) ?? left[0]
    do {
      t.allyMoved = true
      const end = act(ready, true, t)
      if (end) return end
    } while (again(ready))
    ready.acted = true
  }
}

function battle(maxTurns: number): { result: Outcome | 'stall'; tally: Tally } {
  freshBattle(); lastFight = 0
  const t: Tally = { hits: { ally: noHits(), foe: noHits() }, mag: { ally: noHits(), foe: noHits() }, heal: { ally: 0, foe: 0 }, foeRests: 0, foeActs: 0, allyRests: 0, levelUps: 0, leadLow: 100, leadEarly: false, allyMoved: false }
  startEvents()
  const lead = member([0, 0])!
  const watch = () => { t.leadLow = Math.min(t.leadLow, Math.round(lead.hp / lead.maxHp * 100)) }
  for (; S.turn <= maxTurns; S.turn++) {
    for (const u of [...S.units, ...S.reserve]) { u.acted = false; u.moved = false; u.steps = 0; u.ticked = false; u.again = false }
    turnStart()
    for (const step of S.ed.order([...S.units, ...S.reserve], S.turn)) {
      const live = step.filter(u => u.hp > 0 && S.units.includes(u))
      if (!live.length) continue
      if (live[0].troop === 0) {
        for (const u of live) { const r = tick(u); if (r && r !== 'skip') return { result: r, tally: t } }
        const end = partyStep(live, t)
        watch()
        if (end) return { result: end, tally: t }
        continue
      }
      for (const u of step) {
        if (u.hp <= 0 || !S.units.includes(u)) continue
        const r = tick(u)
        if (r === 'skip') continue
        if (r) return { result: r, tally: t }
        do {
          const end = act(u, false, t)
          watch()
          if (end) { if (end === 'lose' && !t.allyMoved) t.leadEarly = lead.hp <= 0; return { result: end, tally: t } }
        } while (again(u))
      }
    }
  }
  return { result: 'stall', tally: t }
}

// ---------- 루트 하나 ----------

async function runRoute(o: Opts, route: number, data: { battles: Battles }) {
  restore({ flags: [], party: [], items: [] })
  PARTY.push(...S.scenes.party)
  const rows: Row[] = []
  let n = 1, r = 0
  for (;;) {
    S.def = stageDef(n, r, true)
    const rec = data.battles.records[`${n}-${r}`] ?? data.battles.records[[0, 1, 2].map(k => `${n}-${k}`).find(k => k in data.battles.records)!]
    if (n === TEMPLE) {   // 환의 성전: 지도 넷이면 들어가고 (지도는 지운다), 아니면 건너뜀 (battle.ts boot)
      const all4 = ITEMS.filter(i => MAPS.includes(i)).length === 4
      if (all4) ITEMS.splice(0, ITEMS.length, ...ITEMS.filter(i => !MAPS.includes(i)))
      const next = nextStage(TEMPLE, r)
      if (!all4 && next && 'n' in next) { n = next.n; continue }
    }
    const max = Math.min(8, rec.slots.length)
    if (o.book) equipBook()
    S.deploy = pickDeploy(max, o.pick)
    promoteDeployed(S.deploy)
    if (o.tools) equipTools()
    const map = await (await fetch(`/assets/stages/${String(n).padStart(2, '0')}.json`)).json() as StageMap
    S.map = map
    Object.assign(S, placements(rec, map))
    S.reward = rec.reward
    S.treasure = rec.treasure ?? []
    S.cond = data.battles.cond[n] ?? []
    S.turnEv = data.battles.turn[n] ?? []
    S.startEv = data.battles.start?.[n] ?? []
    const before: Camp = snapshot()
    const deployedTypes = S.deploy.map(i => partyType(PARTY[i]))
    let out: ReturnType<typeof battle> | null = null, tries = 0
    for (; tries <= o.retry; tries++) {
      restore(before)   // 다시 하기 = 장 시작 상태로 (레벨업 난수만 달라진다)
      out = battle(o.turns)
      if (out.result === 'win' || out.result === 'ending') break
    }
    const res = out!
    const foes = [...S.units, ...S.reserve].filter(u => u.side === 'enemy')
    const row: Row = {
      n, route: r, result: res.result, tries: Math.min(tries + 1, o.retry + 1), turns: Math.min(S.turn, o.turns),
      deployed: S.deploy.length, partyLv: avg(deployedTypes.map(t => t.lv)), partyMax: Math.max(...deployedTypes.map(t => t.lv)),
      allLv: avg(PARTY.map(t => partyType(t).lv)), minLv: Math.min(...PARTY.map(t => partyType(t).lv)),
      foes: foes.length, foeLv: avg(foes.map(u => u.type.lv)), foeMax: Math.max(0, ...foes.map(u => u.type.lv)),
      fallen: S.units.filter(u => u.troop === 0 && u.hp <= 0 && !u.absent).map(u => u.type.name),
      npcFallen: S.units.filter(u => u.side === 'ally' && u.troop !== 0 && u.hp <= 0).length,
      leadLow: res.tally.leadLow, leadEarly: res.tally.leadEarly, foeRests: res.tally.foeRests, foeActs: res.tally.foeActs,
      allyRests: res.tally.allyRests, levelUps: res.tally.levelUps, joined: [], hits: res.tally.hits, mag: res.tally.mag, heal: res.tally.heal,
    }
    if (res.result === 'lose') {
      const lose = S.cond.filter(c => c.do.includes('lose') && 'dead' in c.if && c.if.dead.every(m => (member(m)?.hp ?? 1) <= 0))
      row.lostBy = lose.length ? lose.flatMap(c => 'dead' in c.if ? c.if.dead.map(m => member(m)!.type.name) : []).join('·') : member([0, 0])!.type.name
    }
    rows.push(row)
    if (o.until && n >= o.until) break
    if (!o.json) printRow(row)
    if (res.result !== 'win' && res.result !== 'ending') {
      if (!o.push) break
      row.pushed = true   // 이긴 셈 치고 이어 간다: 장 끝 단계는 그대로, 경험치는 마지막 시도 것
    }
    // 승리 처리 (battle.ts checkEnd 뒤): 보상·합류·전투 후 단계. 개선판 대본이 단계를 가지면 대본이 대신 (선택지는 첫째)
    const had = new Set(PARTY)
    S.ed.afterWin?.([], row.pushed || !costs ? undefined : before)   // 개선판: 대기 동료 경험치·쓰러진 대가 (battle.ts checkEnd 와 같은 자리). 진 장을 이어 가는 근사에는 대가 없음
    const done = finishStage(S.joined, S.reward, aliveMember, ownsSteps(chapter()))
    if (S.ed.id === 'remake') runSteps([...blocksAt(chapter(), 'win'), ...blocksAt(chapter(), 'post')], aliveMember)
    else if (done.scenes.includes(GOLD.scene)) giveGold()   // 원작판 9장 「금괴조각주기」 = 결정
    row.joined = PARTY.filter(t => !had.has(t)).map(t => S.types[t].name)
    if (row.joined.length && !o.json) console.log(`      + ${row.joined.join(', ')}`)
    if (res.result === 'ending') break
    const next = nextStage(n, r)
    if (!next) break
    if ('choose' in next) { n = next.choose[route]; r = route } else { n = next.n; r = next.route }
  }
  return rows
}

const RES: Record<string, string> = { win: '승', ending: '끝', lose: '패', stall: '정체' }
function printRow(w: Row) {
  console.log([`${String(w.n).padStart(2)}장`, RES[w.result] + (w.tries > 1 ? `(${w.tries})` : '') + (w.pushed ? '→계속' : ''), `${w.turns}턴`,
    `일행 ${w.deployed}명 Lv${w.partyLv} (최고 ${w.partyMax})`, `적 ${w.foes} Lv${w.foeLv} (최고 ${w.foeMax})`,
    `쓰러짐 ${w.fallen.length ? w.fallen.join('·') : '-'}${w.npcFallen ? ` NPC ${w.npcFallen}` : ''}`, `선두 최저 ${w.leadLow}%`,
    `적 휴식 ${w.foeRests}/${w.foeActs + w.foeRests}`, `레벨업 ${w.levelUps}`, w.leadEarly ? '첫 차례 전 선두 쓰러짐' : ''].filter(Boolean).join(' | '))
}

export async function main(argv: string[]) {
  const arg = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d }
  const route = arg('route', 'all')
  // 피해 조정 (rules.ts Tuning) — 그 판 값에서 바꾼다: --dmg orig | floor:0.15 | ratio:0.4 (물리식), --spell N (생명상해 배율), --heal N (생명회복 배율),
  //   --dmg-enemy·--spell-enemy·--heal-enemy = 적이 칠 때만
  const parse = (v: string) => { const [form, coef] = v.split(':'); return { form: form as Tuning['form'], coef: Number(coef ?? 0) } }
  const base = arg('ed', 'remake') === 'original' ? original : remake
  const keys = ['dmg', 'spell', 'heal', 'dmg-enemy', 'spell-enemy', 'heal-enemy'].filter(k => argv.includes(`--${k}`))
  const dmg = keys.map(k => `${k} ${arg(k, '')}`).join(' ')
  const tuned = (): Tuning => {
    const t0 = base === remake ? remakeTuning : ORIGINAL
    const side = (t: Omit<Tuning, 'enemy'>, sfx: string) => ({ ...t, ...argv.includes(`--dmg${sfx}`) ? parse(arg(`dmg${sfx}`, 'orig')) : {},
      ...argv.includes(`--spell${sfx}`) ? { spell: Number(arg(`spell${sfx}`, '1')) } : {}, ...argv.includes(`--heal${sfx}`) ? { heal: Number(arg(`heal${sfx}`, '1')) } : {} })
    return { ...side(t0, ''), enemy: side(t0.enemy ?? t0, '-enemy') }
  }
  const o: Opts = {
    ed: { ...base, ...keys.length ? { rules: makeRules(tuned()) } : {}, ...argv.includes('--tune') ? { tune: { ...base.tune, ...JSON.parse(arg('tune', '{}')) } } : {}, ...arg('growth', 'yes') === 'no' ? { afterWin: undefined, partyChange: undefined } : {} },
    routes: route === 'all' ? [0, 1, 2] : [Number(route)],
    seed: Number(arg('seed', '1')), pick: arg('pick', 'level') === 'front' ? 'front' : 'level', book: arg('book', 'yes') !== 'no', tools: arg('tools', 'yes') !== 'no',
    until: Number(arg('until', '0')) || undefined,
    turns: Number(arg('turns', '60')), retry: Number(arg('retry', '2')), push: arg('push', 'yes') !== 'no', dmg, json: argv.includes('--json'),
    careful: (['lead', 'all', 'none'].includes(arg('careful', 'all')) ? arg('careful', 'all') : 'all') as Opts['careful'],
  }
  careful = o.careful
  const [tables, dialogue, battles, scenes] = await Promise.all([loadTables(), loadDialogue(), loadBattles(), loadScenes()])
  S.ed = o.ed
  S.tables = tables
  S.types = tables.types
  S.dialogue = dialogue
  S.scenes = scenes
  S.routeTable = battles.route
  initScript(o.ed.script, tables.types)
  const seeds = arg('seeds', '')
  if (seeds) return summary(o, seeds, battles)
  const out: Record<string, Row[]> = {}
  for (const r of o.routes) {
    seedRandom(o.seed)
    if (!o.json) console.log(`\n== ${o.ed.name} 루트 ${'ABC'[r]} (씨앗 ${o.seed}, 출전 ${o.pick}, 조심 ${o.careful}) ==`)
    out['ABC'[r]] = await runRoute(o, r, { battles })
  }
  if (o.json) console.log(JSON.stringify(out))
}

/** --seeds 1-20: 씨앗마다 루트를 돌려 장마다 모은다 — 이긴 비율 (첫 시도·다시 하기 포함), 턴, 일행·적 평균 레벨, 쓰러진 아군 수, 선두 최저 HP, 적 휴식 비율 */
async function summary(o: Opts, seeds: string, battles: Battles) {
  const [a, b] = seeds.split('-').map(Number), list = Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i)
  const q = { ...o, json: true }
  const med = (xs: number[]) => { const v = [...xs].sort((x, y) => x - y); return v.length ? v[v.length >> 1] : 0 }
  for (const r of o.routes) {
    const by = new Map<number, Row[]>()
    for (const seed of list) {
      seedRandom(seed)
      for (const w of await runRoute(q, r, { battles })) by.set(w.n, [...by.get(w.n) ?? [], w])
    }
    console.log(`\n== ${o.ed.name} 루트 ${'ABC'[r]} — 씨앗 ${list.length}개 (출전 ${o.pick}, 조심 ${o.careful}, 도구 ${o.tools ? '끼움' : '그대로'}${o.dmg ? `, 피해식 ${o.dmg}` : ''}) ==`)
    console.log('장 | 첫판 승 | 다시 하기 포함 | 턴 (중앙) | 일행 Lv | 적 Lv (최고) | 차이 | 쓰러진 아군 | 선두 최저 HP | 적 휴식 | 첫 차례 전 선두 쓰러짐 | 일행 전체 Lv (최저) | 진 까닭')
    const tot = { ally: noHits(), foe: noHits() }, mag = { ally: noHits(), foe: noHits() }, heal = { ally: 0, foe: 0 }
    for (const ws of by.values()) for (const w of ws) for (const k of ['ally', 'foe'] as const) {
      for (const f of ['n', 'one', 'half', 'sum', 'pts'] as const) { tot[k][f] += w.hits[k][f]; mag[k][f] += w.mag[k][f] }
      heal[k] += w.heal[k]
    }
    const pct = (a: number, b: number) => Math.round(a / Math.max(1, b) * 100)
    const show = (h: Hits) => `1 피해 ${pct(h.one, h.n)}% · 절반 넘는 한 방 ${pct(h.half, h.n)}% · 한 방 평균 최대HP ${pct(h.sum, h.n)}%`
    console.log(`타격 — 아군이 칠 때: ${show(tot.ally)} / 적이 칠 때: ${show(tot.foe)}`)
    const share = (k: 'ally' | 'foe') => `마법 몫 ${pct(mag[k].pts, mag[k].pts + tot[k].pts)}% · 마법 한 방 평균 최대HP ${pct(mag[k].sum, mag[k].n)}% · 회복 ${pct(heal[k], tot[k === 'ally' ? 'foe' : 'ally'].pts + mag[k === 'ally' ? 'foe' : 'ally'].pts)}%`
    console.log(`마법 — 아군: ${share('ally')} / 적: ${share('foe')}   (회복 = 받은 피해 대비)`)
    for (const [n, ws] of by) {
      const won = (w: Row) => w.result === 'win' || w.result === 'ending'
      const pct = (k: number) => `${Math.round(k / ws.length * 100)}%`
      const pl = avg(ws.map(w => w.partyLv)), fl = ws[0].foeLv
      const rests = ws.reduce((x, w) => x + w.foeRests, 0), acts = ws.reduce((x, w) => x + w.foeRests + w.foeActs, 0)
      console.log([`${n}`, pct(ws.filter(w => won(w) && w.tries === 1).length), pct(ws.filter(won).length), med(ws.map(w => w.turns)),
        pl, `${fl} (${ws[0].foeMax})`, Math.round((fl - pl) * 10) / 10, avg(ws.map(w => w.fallen.length)), `${med(ws.map(w => w.leadLow))}%`,
        `${Math.round(rests / Math.max(1, acts) * 1000) / 10}%`, pct(ws.filter(w => w.leadEarly).length), `${avg(ws.map(w => w.allLv))} (${avg(ws.map(w => w.minLv))})`,
        [...ws.reduce((m, w) => w.lostBy ? m.set(w.lostBy, (m.get(w.lostBy) ?? 0) + 1) : m, new Map<string, number>())].map(([k, v]) => `${k} ${v}`).join(', ') || '-'].join(' | '))
    }
  }
}
