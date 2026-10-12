// 전투 진행: 초기화·동작·승패·턴. 규칙·행동 순서·AI 는 판(S.ed)이 정한다
import { loadBattles, loadDialogue, loadScenes, loadStage, loadTables, loadUnitSprite, type BattleRecord, type CondDo, type CondIf, type Member } from './data'
import { FLAGS, joinLine, nextStage, postLines, sceneLines } from './campaign'
import type { Edition } from './edition'
import { inRange, pathTo, reachable } from './grid'
import { centerOn, centerOnIfOff, frame, resize, toScreen } from './render'
import { recordClear } from './save'
import { stageDef, type Placement, type StageDef } from './stage'
import { alive, isNpc, S } from './state'
import { hideMenu, playDialogue, showForecast, showMenu, showResult, toast, ui } from './ui'
import { equippedStats, type Pos, type Unit } from './unit'

const STEP_MS = 110

// ---------- 초기화 ----------

let uidSeq = 0
function spawn(p: Placement, side: Unit['side']): Unit {
  const t = S.types[p.type]
  const st = equippedStats(t, S.tables.items)
  if (S.troopInit[p.troop] === 3) st.mov = 0   // 상태 3 = 제자리 고정 (원작 124e:1d41, 전투 로드 때만)
  return {
    uid: uidSeq++, type: t, side, troop: p.troop, member: p.member, x: p.x, y: p.y, hp: st.maxHp, ...st,
    range: S.ed.rules.weaponRange(t, S.tables.items), acted: false, moved: false,
    facing: side === 'ally' ? 'left' : 'right', px: p.x, py: p.y, alpha: 1, flash: 0,
  }
}

// 부대 순서 = 0 일행, (npc 있으면) 1 npc, 이후 적 무리 — 원작 부대 배열과 같게 번호를 매긴다 (formats.md "전투 승패 조건")
function placements(rec: BattleRecord) {
  const allies: Placement[] = S.scenes.party.slice(0, rec.slots.length)
    .map((type, i) => ({ type, x: rec.slots[i][0], y: rec.slots[i][1], troop: 0, member: i }))
  const troopInit = [0]
  if (rec.npc.length) troopInit.push(rec.npcState)
  rec.npc.forEach((n, i) => allies.push({ type: n.type, x: n.at[0], y: n.at[1], troop: 1, member: i }))
  const base = troopInit.length
  const enemies: Placement[] = rec.groups.flatMap((g, k) =>
    g.units.map((u, i) => ({ type: u.type, x: u.at[0], y: u.at[1], troop: base + k, member: i })))
  troopInit.push(...rec.groups.map(g => g.active))
  return { allies, enemies, troopInit }
}

let looping = false

/** 장을 불러와 시작한다. 결과 화면에서 다음 장으로 갈 때 다시 불린다 */
export async function boot(ed: Edition, def: StageDef) {
  S.ed = ed
  S.def = def
  const [tables, dialogue, stage, battles, scenes] = await Promise.all([loadTables(), loadDialogue(), loadStage(def.n), loadBattles(), loadScenes()])
  S.tables = tables
  S.scenes = scenes
  S.routeTable = battles.route
  const rec = battles.records[`${def.n}-${def.route}`] ?? battles.records[[0, 1, 2].map(r => `${def.n}-${r}`).find(k => k in battles.records)!]
  Object.assign(S, placements(rec))
  S.cond = battles.cond[def.n] ?? []
  S.turnEv = battles.turn[def.n] ?? []
  S.types = tables.types
  S.dialogue = dialogue
  S.map = stage.map
  S.atlas = stage.atlas
  const ids = new Set([...S.allies, ...S.enemies].map(p => p.type))
  await Promise.all([...ids].map(async id => S.sprites.set(id, await loadUnitSprite(id))))
  ui.title.textContent = `${def.title} · ${ed.name}`
  S.floats = []
  resize()
  if (!looping) { looping = true; requestAnimationFrame(frame) }
  await start()
}

async function start() {
  uidSeq = 0
  const all = [...S.allies.map(p => spawn(p, 'ally')), ...S.enemies.map(p => spawn(p, 'enemy'))]
  S.troopState = [...S.troopInit]
  S.units = all.filter(u => S.troopState[u.troop] !== 4)
  S.reserve = all.filter(u => S.troopState[u.troop] === 4)
  S.fired.clear()
  S.turn = 1
  S.active = []
  S.mode = { kind: 'busy' }
  centerOn(S.units[0])
  await playDialogue(sceneLines(S.scenes.pre[S.def.n] ?? []))
  await runRounds()
}

// ---------- 동작 (애니메이션 포함) ----------

const sleep = (ms: number) => new Promise(ok => setTimeout(ok, ms))

export async function walk(u: Unit, path: Pos[]) {
  if (path.length > 1) u.moved = true
  for (const p of path.slice(1)) {
    u.facing = p.x > u.x ? 'right' : p.x < u.x ? 'left' : p.y > u.y ? 'down' : 'up'
    const sx = u.x, sy = u.y, t0 = performance.now()
    u.x = p.x; u.y = p.y
    await new Promise<void>(ok => {
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / STEP_MS)
        u.px = sx + (p.x - sx) * k
        u.py = sy + (p.y - sy) * k
        k < 1 ? requestAnimationFrame(tick) : ok()
      }
      tick()
    })
  }
  u.px = u.x; u.py = u.y
}

async function attack(a: Unit, d: Unit) {
  a.facing = d.x > a.x ? 'right' : d.x < a.x ? 'left' : d.y > a.y ? 'down' : 'up'
  // 상대 쪽으로 살짝 밀고 들어갔다 돌아오기
  const dx = Math.sign(d.x - a.x) * 0.25, dy = Math.sign(d.y - a.y) * 0.25
  a.px += dx; a.py += dy
  await sleep(120)
  a.px = a.x; a.py = a.y
  const dmg = S.ed.rules.rollDamage(a, d)
  d.hp = Math.max(0, d.hp - dmg)
  if (S.troopState[d.troop] === 1) S.troopState[d.troop] = 0   // 경계 부대는 맞으면 깨어난다 (원작 20ec:93b5)
  d.flash = performance.now() + 160
  S.floats.push({ x: d.x, y: d.y, text: `-${dmg}`, t0: performance.now(), color: d.side === 'ally' ? '#ff8080' : '#ffffff' })
  await sleep(350)
  if (d.hp <= 0) {
    for (let i = 10; i >= 0; i--) { d.alpha = i / 10; await sleep(30) }
  }
}

/** 휴식 [확정 20ec:038e]: HP 를 판 규칙만큼 (최대HP 까지) 회복 */
function rest(u: Unit) {
  const heal = Math.min(S.ed.rules.restHeal(u), u.maxHp - u.hp)
  u.hp += heal
  S.floats.push({ x: u.x, y: u.y, text: heal ? `+${heal}` : '휴식', t0: performance.now(), color: '#7dff9a' })
}

/** 유닛 차례 끝. 개선판은 이동·공격 없이 마치면 휴식 */
function finishUnit(u: Unit, attacked = false) {
  if (S.ed.features.autoRest && !attacked && !u.moved) rest(u)
  u.acted = true
  S.mode = { kind: 'idle' }
  hideMenu()
  showForecast(null, null)
  void checkEnd().then(over => {
    if (over) stepDone?.(true)
    else if (S.active.every(a => a.acted || a.hp <= 0)) stepDone?.(false)
  })
}

// ---------- 승패 (원작 2ff8:0def 전투 루프 + 124e:d4a7 장별 조건) ----------

const member = ([t, m]: Member) => [...S.units, ...S.reserve].find(u => u.troop === t && u.member === m)
const dead = (r: Member) => { const u = member(r); return !!u && u.hp <= 0 }
// +0x1d56 남은 적 수 — 숨은 부대 대원도 센다
const enemiesLeft = () => [...S.units, ...S.reserve].filter(u => u.side === 'enemy' && u.hp > 0)

function test(c: CondIf): boolean {
  if ('dead' in c) return c.dead.every(dead)
  const lead = member([0, 0])!
  if ('reach' in c) return lead.x === c.reach[0] && lead.y === c.reach[1]
  if ('hpBelow' in c) { const u = member(c.hpBelow[0]); return !!u && u.hp > 0 && u.hp < u.maxHp * c.hpBelow[1] }
  const left = enemiesLeft()
  return left.length === 1 && left[0] === member(c.onlyLeft)
}

// 부대 상태를 바꾼다. 숨김(4)에서 풀리면 맵에 나온다. 0~3 의미는 editions/original/ai.ts
function setTroop(t: number, v: number) {
  S.troopState[t] = v
  if (v === 4) return
  for (const u of S.reserve.filter(u => u.troop === t)) {
    S.reserve.splice(S.reserve.indexOf(u), 1)
    S.units.push(u)
  }
}

export async function checkEnd(): Promise<boolean> {
  const lead = member([0, 0])!
  let result: 'win' | 'lose' | 'ending' | null = lead.hp <= 0 ? 'lose' : null
  const lines: { text: string }[] = [], scenes: string[] = []
  let fallen = lead
  for (const [i, rule] of S.cond.entries()) {
    if (result || S.fired.has(i) || !test(rule.if)) continue
    S.fired.add(i)
    for (const d of rule.do as CondDo[]) {
      if (typeof d === 'string') {
        result = d
        if (d === 'lose' && 'dead' in rule.if) fallen = member(rule.if.dead[0])!
      }
      else if ('state' in d) d.state[0].forEach(t => setTroop(t, d.state[1]))
      else if ('scene' in d) scenes.push(d.scene)
      else if ('flag' in d) FLAGS.add(d.flag)
      else lines.push(joinLine(d.join))
    }
  }
  if (!result && !enemiesLeft().length) result = 'win'
  if (result === 'lose') {
    S.mode = { kind: 'busy' }
    showResult('패배', `${fallen.type.name}이(가) 쓰러졌다.`, [['다시 하기', () => void start()], ['타이틀로', toTitle]])
    return true
  }
  const prev = S.mode
  if (result) { S.mode = { kind: 'busy' }; await sleep(400) }
  if (scenes.length || lines.length) {
    S.mode = { kind: 'busy' }
    await playDialogue([...sceneLines(scenes), ...lines])
    if (!result) S.mode = prev
  }
  if (!result) return false
  await playDialogue(postLines(S.def.n))
  cleared(result === 'ending')
  return true
}

/** 타이틀로: 페이지를 새로 불러 전투 상태를 깨끗이 버린다 (판은 save 의 마지막 판으로 기억) */
export const toTitle = () => { location.href = location.pathname }

function cleared(ending: boolean) {
  const def = S.def, next = ending ? null : nextStage(def.n, def.route)
  if (def.campaign) recordClear(S.ed.id, def, next && 'n' in next ? next : null, [...FLAGS])
  const go = (n: number, route: number) => {
    if (def.campaign) recordClear(S.ed.id, def, { n, route }, [...FLAGS])   // 진로 선택 결과를 남긴다
    void boot(S.ed, stageDef(n, route, true))
  }
  const buttons: [string, () => void][] = []
  if (def.campaign && next) buttons.push(['다음 장', 'n' in next ? () => go(next.n, next.route) : () =>
    showResult('진로 선택', '어느 길로 갈까?', S.ed.routeLabels.map((l, r): [string, () => void] => [l, () => go(next.choose[r], r)]))])
  buttons.push(['다시 하기', () => void start()], ['타이틀로', toTitle])
  showResult(ending ? '엔딩' : '승리', `${S.turn}턴 만에 ${def.title} 클리어${ending ? ' — 엔딩' : ''}`, buttons,
    def.campaign && next ? '장 사이 연결(합류·소지품)은 아직 없어 다음 장도 처음 일행으로 시작합니다.' : '')
}

// ---------- 턴 ----------

let phaseText = ''
function updatePhase(text = phaseText) {
  phaseText = text
  ui.phase.textContent = `턴 ${S.turn} · ${text}`
  ui.btnEnd.disabled = S.mode.kind === 'busy' || !stepDone
}

// 턴 시작 이벤트 (원작 124e:e0a5, 턴 수를 올린 직후)
async function turnEvents() {
  const scenes: string[] = []
  for (const e of S.turnEv) {
    if ((e.route ?? S.def.route) !== S.def.route || (e.flag && !FLAGS.has(e.flag))) continue
    if (e.area) {
      const [t, cells] = e.area
      // 일행 대원을 순서대로 보다가 사망 대원을 만나면 그만둔다 (원작 그대로)
      const party = [...S.units, ...S.reserve].filter(u => u.troop === 0).sort((a, b) => a.member - b.member)
      for (const u of party) {
        if (u.hp <= 0) break
        if (cells.some(([x, y]) => x === u.x && y === u.y)) { if (S.troopState[t] !== 0) setTroop(t, 0); break }
      }
    } else if (e.turn === S.turn) {
      for (const d of e.do ?? []) {
        if (typeof d === 'string') continue
        if ('state' in d) d.state[0].forEach(t => setTroop(t, d.state[1]))
        else if ('scene' in d) scenes.push(d.scene)
      }
    }
  }
  if (scenes.length) await playDialogue(sceneLines(scenes))
}

/** 라운드 반복. 판의 order() 가 준 행동 단계를 차례로 실행한다 (원작판 = 한 명씩, 개선판 = 페이즈제). 전투가 끝나면 돌아온다 */
async function runRounds() {
  for (;;) {
    for (const u of S.units) { u.acted = false; u.moved = false }
    S.mode = { kind: 'busy' }
    await turnEvents()
    let bannered = false
    for (const step of S.ed.order([...S.units, ...S.reserve], S.turn)) {
      const live = step.filter(u => u.hp > 0 && S.units.includes(u))
      if (!live.length) continue
      const lead = live[0], party = lead.troop === 0
      const label = party ? '아군' : isNpc(lead) ? 'NPC' : '적'
      if (step.length > 1) {
        // 페이즈 단계: 페이즈마다 알림
        updatePhase(`${label} 차례`)
        await toast(party ? `턴 ${S.turn} · 아군` : `${label} 차례`, party ? 'ally' : isNpc(lead) ? 'npc' : 'enemy', party ? 700 : 600)
        bannered = true
      } else if (!bannered) {
        updatePhase(`${lead.type.name} 차례`)
        await toast(`턴 ${S.turn}`, 'ally', 700)
        bannered = true
      }
      if (await (party ? playerStep(live) : aiStep(step))) return
    }
    S.turn++
  }
}

// 플레이어 단계: 단계의 일행 대원이 모두 행동하거나 턴 종료(원작판은 대기)를 누를 때까지
let stepDone: ((over: boolean) => void) | null = null
function playerStep(units: Unit[]): Promise<boolean> {
  return new Promise(ok => {
    S.active = units
    stepDone = over => { stepDone = null; S.active = []; ok(over) }
    S.mode = { kind: 'idle' }
    if (units.length === 1) {
      centerOnIfOff(units[0])
      if (!S.ed.features.commandFirst) select(units[0])   // 원작판은 유닛을 눌러 명령부터 고른다
    }
    updatePhase(units.length > 1 ? '아군 차례' : `${units[0].type.name} 차례`)
  })
}

export function endPlayerStep() {
  if (S.mode.kind === 'busy' || !stepDone) return
  cancel()
  for (const u of S.active) {
    if (!u.acted && u.hp > 0 && S.ed.features.autoRest && !u.moved) rest(u)
    u.acted = true
  }
  S.mode = { kind: 'busy' }
  stepDone(false)
}

/** 컴퓨터 조종 유닛을 차례로 움직인다. 전투가 끝나면 true */
async function aiStep(units: Unit[]): Promise<boolean> {
  for (const u of units) {
    if (u.hp <= 0 || !S.units.includes(u)) continue
    const plan = S.ed.planFor(S.map, S.units, u, S.troopState)
    const path = pathTo(reachable(S.map, S.units, u), plan.dest.x, plan.dest.y)
    const acts = path.length > 1 || (plan.target && plan.target.hp > 0)
    if (acts && units.length === 1) updatePhase(`${u.type.name} 차례`)
    if (path.length > 1) { centerOnIfOff(u); await walk(u, path) }
    if (plan.target && plan.target.hp > 0) { centerOnIfOff(u); await attack(u, plan.target) }
    if (await checkEnd()) return true
  }
  return false
}

// ---------- 플레이어 명령 ----------

export function select(u: Unit) {
  S.mode = { kind: 'selected', unit: u, moves: reachable(S.map, S.units, u) }
}

export function cancel() {
  const md = S.mode
  hideMenu()
  showForecast(null, null)
  if (md.kind === 'moved' || md.kind === 'targeting') {
    // 행동 전이면 이동 취소 (원위치)
    md.unit.x = md.unit.px = md.from.x
    md.unit.y = md.unit.py = md.from.y
    md.unit.moved = false
    select(md.unit)
  } else if (md.kind === 'selected') S.mode = { kind: 'idle' }
}

/** 원작판: 차례인 유닛을 누르면 여는 명령창 (원작 20ec:eb81 → 0 이동 20ec:cb07, 제자리 행동 20ec:d900). 아이콘 5개 중 확인된 것만 */
export function commandMenu(u: Unit) {
  const here = { x: u.x, y: u.y }
  const targets = alive('enemy').filter(e => inRange(u, u, e))
  const { sx, sy } = toScreen(u.x + 1, u.y)
  const items: [string, () => void][] = [['이동', () => { hideMenu(); select(u) }]]
  if (targets.length) items.push(['전투', () => { hideMenu(); S.mode = { kind: 'targeting', unit: u, from: here } }])
  items.push(['취소', () => { hideMenu(); S.mode = { kind: 'idle' } }])
  S.mode = { kind: 'idle' }
  showMenu(items, sx + 4, sy, u.type.name)
}

/** 원작판 휴식: 움직이기 전에 취소하면 "휴식?" (20ec:c25c, 예 → 회복하고 차례 끝). 움직였으면 먼저 제자리로 */
export function restPrompt() {
  if (S.mode.kind === 'busy' || !stepDone) return
  const u = S.active.find(a => !a.acted && a.hp > 0)
  if (!u) return
  if (S.mode.kind === 'moved' || S.mode.kind === 'targeting') cancel()
  hideMenu()
  showForecast(null, null)
  S.mode = { kind: 'idle' }
  const { sx, sy } = toScreen(u.x + 1, u.y)
  showMenu([['예', () => { rest(u); finishUnit(u) }], ['아니오', () => hideMenu()]], sx + 4, sy, '휴식?')
}

/** Esc·우클릭. 원작판은 이동을 되돌리고, 제자리면 휴식을 묻는다 (원작 취소 흐름) */
export function back() {
  if (!S.ed.features.commandFirst) { cancel(); return }
  const md = S.mode
  if (!ui.menu.hidden && md.kind === 'idle') { hideMenu(); return }
  if (md.kind === 'moved' || md.kind === 'targeting') { cancel(); S.mode = { kind: 'idle' }; return }
  if (md.kind === 'selected') { S.mode = { kind: 'idle' }; return }
  if (md.kind === 'idle') restPrompt()
}

export function actionMenu(u: Unit, from: Pos) {
  S.mode = { kind: 'moved', unit: u, from }
  const targets = alive('enemy').filter(e => inRange(u, u, e))
  const { sx, sy } = toScreen(u.x + 1, u.y)
  const items: [string, () => void][] = []
  if (targets.length) items.push([S.ed.features.commandFirst ? '전투' : '공격', () => { hideMenu(); S.mode = { kind: 'targeting', unit: u, from } }])
  items.push(['대기', () => finishUnit(u)], ['취소', () => cancel()])
  showMenu(items, sx + 4, sy)
}

export async function doAttack(u: Unit, target: Unit) {
  S.mode = { kind: 'busy' }
  hideMenu()
  showForecast(null, null)
  await attack(u, target)
  finishUnit(u, true)
}
