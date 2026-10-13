// 전투 진행: 초기화·동작·승패·턴. 규칙·행동 순서·AI 는 판(S.ed)이 정한다
import { loadBattles, loadDialogue, loadScenes, loadStage, loadTables, loadUnitSprite, type BattleRecord, type CondDo, type CondIf, type Member } from './data'
import { EQUIP, FLAGS, ITEMS, PARTY, finishStage, partyType, joinLine, nextStage, restore, sceneLines, snapshot, type Camp } from './campaign'
import type { Edition } from './edition'
import { inRange, pathTo, reachable } from './grid'
import { campScreen } from './camp'
import { fadeIn, fadeOut } from './fade'
import { centerOn, centerOnIfOff, frame, resize, toScreen } from './render'
import { recordClear, recordHidden, recordRun } from './save'
import { FOUND, carryOf } from './replay'
import { SKIP_INTRO } from './title'
import { travelMap } from './worldmap'
import { stageDef, type Placement, type StageDef } from './stage'
import { alive, isNpc, S } from './state'
import { banter, blocksAt, chapter, epilogue, goalStates, initScript, ownsSteps, resetTalk, story, type When } from './script'
import { hideMenu, playDialogue, showForecast, showGoals, showMenu, showResult, toast, ui } from './ui'
import { equippedStats, type Pos, type Unit } from './unit'

const STEP_MS = 110

// ---------- 초기화 ----------

let uidSeq = 0
function spawn(p: Placement, side: Unit['side']): Unit {
  const t = p.troop === 0 ? partyType(p.type) : S.types[p.type]   // 일행은 정비 화면에서 바꾼 장비로
  const st = equippedStats(t, S.tables.items)
  if (S.troopInit[p.troop] === 3) st.mov = 0   // 상태 3 = 제자리 고정 (원작 124e:1d41, 전투 로드 때만)
  return {
    uid: uidSeq++, type: t, side, troop: p.troop, member: p.member, x: p.x, y: p.y, hp: st.maxHp, ...st, fatigue: t.fatigue, steps: 0,
    range: S.ed.rules.weaponRange(t, S.tables.items), acted: false, moved: false,
    facing: side === 'ally' ? 'left' : 'right', px: p.x, py: p.y, alpha: 1, flash: 0,
  }
}

// 부대 순서 = 0 일행, (npc 있으면) 1 npc, 이후 적 무리 — 원작 부대 배열과 같게 번호를 매긴다 (formats.md "전투 승패 조건")
function placements(rec: BattleRecord) {
  // 출전 대원 = 고른 일행 인덱스 순서대로 출전 칸에
  const allies: Placement[] = S.deploy.map((k, i) => ({ type: PARTY[k], x: rec.slots[i][0], y: rec.slots[i][1], troop: 0, member: i }))
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

let atStart: Camp   // 이 장을 시작할 때 장 사이 상태. 다시 하기는 여기로 되돌린다
let askDeploy = true   // ?stage=N 로 바로 연 판은 출전 선택 없이 앞에서부터

/** 장을 불러와 시작한다. 결과 화면에서 다음 장으로 갈 때 다시 불린다.
 *  camp: 장 사이 상태 (null = 캠페인 밖 기본값). 없으면 지금 상태 그대로 (다음 장) */
export async function boot(ed: Edition, def: StageDef, camp?: Partial<Camp> | null) {
  await fadeOut()   // 결과 화면·타이틀에서 넘어올 때 (이미 어두우면 바로)
  S.ed = ed
  S.def = def
  const extra = ed.extraBattles?.[def.n]   // 개선판 숨은 장: 원작 맵 재사용 + 새 배치·고정 일행
  if (extra) S.def = def = { ...def, title: `숨은 장 · ${extra.title}` }
  const [tables, dialogue, stage, battles, scenes] = await Promise.all([loadTables(), loadDialogue(), loadStage(extra?.map ?? def.n), loadBattles(), loadScenes()])
  S.tables = tables
  S.types = tables.types
  initScript(ed.script, tables.types)
  S.scenes = scenes
  S.routeTable = battles.route
  if (extra) restore({ flags: [], party: extra.party, items: extra.items ?? [] })
  else if (camp !== undefined) restore(camp)
  if (camp === null) askDeploy = false
  if (!PARTY.length) PARTY.push(...scenes.party)
  atStart = snapshot()
  const rec = extra?.record ?? battles.records[`${def.n}-${def.route}`] ?? battles.records[[0, 1, 2].map(r => `${def.n}-${r}`).find(k => k in battles.records)!]
  // 출전 인원 상한: 원작은 8 하드코딩 (BAD 칸 수와 비교 안 함), 칸보다 많이 고르면 놓을 곳이 없으므로 칸 수로 자른다
  const max = Math.min(8, rec.slots.length), first = PARTY.slice(0, max).map((_, i) => i)
  S.deploy = first
  if (askDeploy) {   // 두 판 모두 전투마다 정비 화면
    const r = await campScreen({ party: PARTY.map(partyType), items: [...ITEMS], tables, max, remake: !ed.features.originalCamp, initial: first })
    if (r.go === 'title') { toTitle(); return }
    S.deploy = r.deploy
    ITEMS.splice(0, ITEMS.length, ...r.items)
    r.equip.forEach((e, i) => { if (e.join() !== partyType(PARTY[i]).equip.join()) EQUIP.set(PARTY[i], e) })
    atStart = snapshot()   // 다시 하기는 정비 화면에서 고친 소지품·장비로
  }
  if (def.campaign) await travelMap(def.n)   // 원작: 정비 화면 뒤 대륙 지도에 그 장 장소를 잠깐 (숨은 장은 장소 없음 → 건너뜀)
  Object.assign(S, placements(rec))
  S.reward = rec.reward
  S.cond = extra?.cond ?? battles.cond[def.n] ?? []
  S.turnEv = extra?.turn ?? battles.turn[def.n] ?? []
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
  await fadeOut()   // 다시 하기 (boot 에서 오면 이미 어둡다)
  uidSeq = 0
  restore(atStart)   // 전투 중 켠 플래그 (27장 black27 등) 를 버린다
  S.joined = []
  const all = [...S.allies.map(p => spawn(p, 'ally')), ...S.enemies.map(p => spawn(p, 'enemy'))]
  S.troopState = [...S.troopInit]
  S.units = all.filter(u => S.troopState[u.troop] !== 4)
  S.reserve = all.filter(u => S.troopState[u.troop] === 4)
  S.fired.clear()
  told.clear()
  woke.length = 0
  resetTalk()
  S.turn = 1
  S.active = []
  S.mode = { kind: 'busy' }
  centerOn(S.units[0])
  await fadeIn()
  const card = chapter()?.card
  if (card) await toast(`${S.def.n}장 · ${card[0]}${card[1] ? ` — ${card[1]}` : ''}`, 'card', 2200)   // 장 카드 (S2 제안 4)
  renderGoals()
  await story('pre', S.scenes.pre[S.def.n] ?? [], aliveMember)
  await banter('start')
  await runRounds()
}

// ---------- 동작 (애니메이션 포함) ----------

const sleep = (ms: number) => new Promise(ok => setTimeout(ok, ms))

export async function walk(u: Unit, path: Pos[]) {
  if (path.length > 1) u.moved = true
  u.steps += path.length - 1
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
  const dmg = S.ed.rules.rollDamage(S.map, a, d)
  d.hp = Math.max(0, d.hp - dmg)
  if (S.troopState[d.troop] === 1) { S.troopState[d.troop] = 0; woke.push(d.troop) }   // 경계 부대는 맞으면 깨어난다 (원작 20ec:93b5)
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
  u.fatigue = S.ed.rules.restFatigue(u)
  S.floats.push({ x: u.x, y: u.y, text: heal ? `+${heal}` : '휴식', t0: performance.now(), color: '#7dff9a' })
}

/** 유닛 차례 끝. 개선판은 이동·공격 없이 마치면 휴식 */
function finishUnit(u: Unit, attacked = false) {
  if (S.ed.features.autoRest && !attacked && !u.moved) rest(u)
  else tire(u, attacked)
  u.acted = true
  S.mode = { kind: 'idle' }
  hideMenu()
  showForecast(null, null)
  void checkEnd().then(over => {
    if (over) stepDone?.(true)
    else if (S.active.every(a => a.acted || a.hp <= 0)) stepDone?.(false)
  })
}

/** 차례를 마칠 때 피로 (공격·이동). 휴식한 차례는 쌓지 않는다 */
function tire(u: Unit, attacked: boolean) {
  u.fatigue = S.ed.rules.fatigueAfter(u, attacked)
  u.steps = 0
}

// ---------- 승패 (원작 2ff8:0def 전투 루프 + 124e:d4a7 장별 조건) ----------

// 대본의 전투 중 시점 (dead·troop·hp) 은 한 전투에 한 번씩 ("시점:값"). 43장: 사바카 1단·최종 모두 사망 조건
const told = new Set<string>()
const woke: number[] = []   // 움직이기 시작한(상태 0 으로 바뀐) 부대 — 대본 troop N
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
  if (v === 0 && S.troopState[t] !== 0) woke.push(t)
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
  // 장면: 대원 사망 조건의 장면은 대본 시점 dead <이름>, 나머지(마지막 1명 남기기 등)는 승리와 함께 win 으로
  const lines: { text: string }[] = [], deadScenes: [string, string[]][] = [], scenes: string[] = []
  let fallen = lead
  for (const [i, rule] of S.cond.entries()) {
    if (result || S.fired.has(i) || !test(rule.if)) continue
    S.fired.add(i)
    const dname = 'dead' in rule.if ? member(rule.if.dead[0])!.type.name : ''
    const into = dname && !told.has(`dead:${dname}`) ? (told.add(`dead:${dname}`), deadScenes.push([dname, []]), deadScenes.at(-1)![1]) : scenes
    for (const d of rule.do as CondDo[]) {
      if (typeof d === 'string') {
        result = d
        if (d === 'lose' && 'dead' in rule.if) fallen = member(rule.if.dead[0])!
      }
      else if ('state' in d) d.state[0].forEach(t => setTroop(t, d.state[1]))
      else if ('scene' in d) into.push(d.scene)
      else if ('flag' in d) FLAGS.add(d.flag)
      else { S.joined.push(d.join); lines.push(joinLine(d.join)) }
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
  const won = result === 'win' || result === 'ending'
  const moments = scriptMoments()
  const bossTalk = !result && bossHit()
  renderGoals()
  if (bossTalk || deadScenes.some(([w, k]) => k.length || blocksAt(chapter(), 'dead', w).length) || moments.length || scenes.length || lines.length || (won && blocksAt(chapter(), 'win').length)) {
    S.mode = { kind: 'busy' }
    for (const [who, keys] of deadScenes) await story('dead', keys, aliveMember, who)
    for (const [w, a] of moments) await story(w, [], aliveMember, a)
    if (bossTalk) await banter('boss')
    if (won) await story('win', scenes, aliveMember, undefined, lines)
    else if (scenes.length || lines.length) await playDialogue([...sceneLines(scenes), ...lines])
    if (!result) S.mode = prev
  }
  if (!result) return false
  const done = finishStage(S.joined, S.reward, aliveMember, ownsSteps(chapter()))
  await story('post', done.scenes, aliveMember, undefined, done.notes)
  if (result === 'ending' && !S.ed.extraBattles?.[S.def.n]) await epilogue(aliveMember)   // 숨은 장의 엔딩(진엔딩)은 그 장 대본이 맡는다
  else await banter('win')   // 전투 후 장면 뒤 (보스의 마지막 말 다음). 마지막 전투는 에필로그만
  cleared(result === 'ending')
  return true
}

const aliveMember = (t: number, m: number) => (member([t, m])?.hp ?? 0) > 0

const named = (arg: string, u: Unit) => { const m = /^(.+)#(\d+)$/.exec(arg); return m ? u.type.id === Number(m[2]) : u.type.name === arg }

/** 대본에 블록이 있는 전투 중 시점 가운데 방금 일어난 것: troop N (부대 출동), hp 이름 <N% (HP 위험), dead 이름 (원작 장면이 없는 사망) */
function scriptMoments(): [When, string][] {
  const ch = chapter(), out: [When, string][] = []
  const once = (w: When, a: string) => { if (told.has(`${w}:${a}`)) return; told.add(`${w}:${a}`); out.push([w, a]) }
  for (const t of woke.splice(0)) if (blocksAt(ch, 'troop', String(t)).length) once('troop', String(t))
  for (const b of ch?.blocks ?? []) {
    if (!b.arg || told.has(`${b.when}:${b.arg}`)) continue
    if (b.when === 'hp') {
      const [who, pct] = b.arg.split(' '), p = Number(pct.slice(1, -1)) / 100
      if (S.units.some(u => named(who, u) && u.hp > 0 && u.hp < u.maxHp * p)) once('hp', b.arg)
    } else if (b.when === 'dead' && [...S.units, ...S.reserve].some(u => named(b.arg!, u) && u.hp <= 0)) once('dead', b.arg)
  }
  return out
}

/** 보스(패배 조건이 아닌 사망 조건의 대상 = 적 우두머리)가 처음 피해를 입었나 — 동료 한마디 boss (한 전투에 한 번) */
function bossHit() {
  if (told.has('banter:boss')) return false
  const bosses = S.cond.filter(r => 'dead' in r.if && !r.do.includes('lose'))
    .flatMap(r => 'dead' in r.if ? r.if.dead : []).map(member)
  if (!bosses.some(u => u && u.hp > 0 && u.hp < u.maxHp)) return false
  told.add('banter:boss')
  return true
}

/** 목표 창: 장 카드의 목표 + 보조 목표 상태 (개선판 대본이 있을 때만) */
function renderGoals() {
  showGoals(chapter()?.card?.[1] ?? '', goalStates(aliveMember))
}

/** 타이틀로: 페이지를 새로 불러 전투 상태를 깨끗이 버린다 (판은 save 의 마지막 판으로 기억). 로고 연출은 이번만 건너뛴다 */
export const toTitle = () => {
  try { sessionStorage.setItem(SKIP_INTRO, '1') } catch { /* 무시 */ }
  void fadeOut().then(() => { location.href = location.pathname })
}

function cleared(ending: boolean) {
  const def = S.def, next = ending ? null : nextStage(def.n, def.route)
  if (def.campaign) recordClear(S.ed.id, def, next && 'n' in next ? next : null, atStart, snapshot())
  // 판을 넘는 기록: 분기점·엔딩·찾은 사건 (캠페인 진행일 때), 도감 (늘)
  const now = snapshot(), camp = def.campaign
  if (S.ed.extraBattles?.[def.n]) recordHidden(S.ed.id, def.n)
  recordRun(S.ed.id, { route: def.route, now,
    branchNext: camp && next && 'choose' in next ? next.choose : undefined,
    ending: camp && ending ? { carry: carryOf(now, id => S.tables.items.get(id)?.cat) } : undefined,
    found: camp ? FOUND.filter(f => now.party.includes(f.unit)).map(f => f.id) : [],
    seenUnits: S.units.map(u => u.type.id),
    seenItems: [...now.items, ...S.units.filter(u => u.troop === 0).flatMap(u => u.type.equip)] })
  const go = (n: number, route: number) => {
    if (def.campaign) recordClear(S.ed.id, def, { n, route }, atStart, snapshot())   // 진로 선택 결과를 남긴다
    void boot(S.ed, stageDef(n, route, true))
  }
  const buttons: [string, () => void][] = []
  const extraNext = S.ed.extraBattles?.[def.n]?.next
  if (extraNext) buttons.push(['다음 장', () => void boot(S.ed, stageDef(extraNext, 0))])
  else if (def.campaign && next) buttons.push(['다음 장', 'n' in next ? () => go(next.n, next.route) : () =>
    showResult('진로 선택', '어느 길로 갈까?', (S.ed.routeOrder ?? [0, 1, 2]).map((r): [string, () => void] => [S.ed.routeLabels[r], () => go(next.choose[r], r)]))])
  buttons.push(['다시 하기', () => void start()], ['타이틀로', toTitle])
  showResult(ending ? '엔딩' : '승리', `${S.turn}턴 만에 ${def.title} 클리어${ending ? ' — 엔딩' : ''}`, buttons)
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
  await story('turn', scenes, aliveMember, String(S.turn))
  for (const [w, a] of scriptMoments()) await story(w, [], aliveMember, a)
  renderGoals()
}

/** 라운드 반복. 판의 order() 가 준 행동 단계를 차례로 실행한다 (원작판 = 한 명씩, 개선판 = 페이즈제). 전투가 끝나면 돌아온다 */
async function runRounds() {
  for (;;) {
    for (const u of S.units) { u.acted = false; u.moved = false; u.steps = 0 }
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
    else if (!u.acted && u.hp > 0) tire(u, false)
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
    if (plan.rest) { rest(u); continue }
    const path = pathTo(reachable(S.map, S.units, u), plan.dest.x, plan.dest.y)
    const acts = path.length > 1 || (plan.target && plan.target.hp > 0)
    if (acts && units.length === 1) updatePhase(`${u.type.name} 차례`)
    if (path.length > 1) { centerOnIfOff(u); await walk(u, path) }
    const hits = !!plan.target && plan.target.hp > 0
    if (hits) { centerOnIfOff(u); await attack(u, plan.target!) }
    tire(u, hits)
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
    md.unit.steps = 0
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
