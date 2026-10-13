// 전투 진행: 초기화·동작·승패·턴. 규칙·행동 순서·AI 는 판(S.ed)이 정한다
import { loadBattles, loadDialogue, loadScenes, loadStage, loadTables, loadUnitSprite, type BattleRecord, type CondDo, type CondIf, type Member } from './data'
import { EQUIP, FLAGS, ITEMS, PARTY, finishStage, partyType, joinLine, nextStage, restore, sceneLines, snapshot, type Camp } from './campaign'
import type { Edition } from './edition'
import { attackSpots, dist, inRange, key, pathTo, reachable, terrainName } from './grid'
import { campScreen } from './camp'
import { fadeIn, fadeOut } from './fade'
import { canvas, centerOn, centerOnIfOff, frame, resize, toScreen } from './render'
import { layout, view } from './screen'
import { loadSkin, pieceUrl } from './skin'
import { initBand, setDisabled, setOn, setTerrain, setTitle, setTurn } from './band'
import { initMinimap, minimapOn, removeMinimap, setMinimap } from './minimap'
import { aboveUnit, goGo, hideBasic, showBasic, showConditions } from './info'
import { playDialogue } from './dialogue'
import { loadSlots, recordClear, recordHidden, recordRun, writeSlot, writeSuspended, type Suspended } from './save'
import { FOUND, carryOf } from './replay'
import { SKIP_INTRO } from './title'
import { setting } from './settings'
import { travelMap } from './worldmap'
import { stageDef, type Placement, type StageDef } from './stage'
import { alive, canCommand, isNpc, member, S, unitAt } from './state'
import { banter, blocksAt, chapter, epilogue, goalStates, initScript, ownsSteps, resetTalk, story, type When } from './script'
import { back as winBack, modalOpen, closeAll, closeWin, confirmWin, esc, hideMenu, initSkinCss, openWin, showMenu, showResult, type Btn } from './ui'
import { equippedStats, type Pos, type Unit } from './unit'

const STEP_MS = 110
// 개선판 편의 설정: 적 차례 빠르게 (ai), 전투 연출 짧게. 원작판은 늘 1
let aiTurn = false
const pace = () => !remake() ? 1 : (aiTurn && setting('fastEnemy') ? 0.35 : 1) * (setting('shortAnim') ? 0.5 : 1)

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
export async function boot(ed: Edition, def: StageDef, camp?: Partial<Camp> | null, resume?: Suspended) {
  await fadeOut()   // 결과 화면·타이틀에서 넘어올 때 (이미 어두우면 바로)
  S.ed = ed
  S.def = def
  const extra = ed.extraBattles?.[def.n]   // 개선판 숨은 장: 원작 맵 재사용 + 새 배치·고정 일행
  if (extra) S.def = def = { ...def, title: `숨은 장 · ${extra.title}` }
  const [tables, dialogue, stage, battles, scenes] = await Promise.all([loadTables(), loadDialogue(), loadStage(extra?.map ?? def.n), loadBattles(), loadScenes(), loadSkin()])
  initSkinCss()
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
  if (resume) {   // 중단한 전투: 정비 화면·대륙 지도 없이 그 자리부터
    restore(resume.at)
    atStart = snapshot()
    S.deploy = resume.deploy
  } else if (askDeploy) {   // 두 판 모두 전투마다 정비 화면
    const goal = chapter()?.card?.[1]
    const r = await campScreen({ party: PARTY.map(partyType), items: [...ITEMS], tables, max, remake: !ed.features.originalCamp, initial: first,
      preview: ed.id === 'remake' ? `${chapterTitle()}${goal ? `\n${goal}` : ''}` : undefined,
      slots: { list: () => loadSlots(ed.id).map(s => s?.title ?? null), save: (i, items, equip) => {
        const base = snapshot(), rec = { ...base.equip }
        equip.forEach((e, k) => { rec[PARTY[k]] = e })
        writeSlot(ed.id, i, { n: def.n, route: def.route, title: chapterTitle(), at: Date.now(), camp: { ...base, items, equip: rec } })
      } } })
    if (r.go === 'title') { toTitle(); return }
    if (r.go === 'load') {   // 기록한 칸의 정비 화면부터
      const s = loadSlots(ed.id)[r.slot]
      if (s) { void boot(ed, stageDef(s.n, s.route, true), s.camp); return }
    }
    if (r.go !== 'battle') return
    S.deploy = r.deploy
    ITEMS.splice(0, ITEMS.length, ...r.items)
    r.equip.forEach((e, i) => { if (e.join() !== partyType(PARTY[i]).equip.join()) EQUIP.set(PARTY[i], e) })
    atStart = snapshot()   // 다시 하기는 정비 화면에서 고친 소지품·장비로
  }
  if (def.campaign && !resume) await travelMap(def.n)   // 원작: 정비 화면 뒤 대륙 지도에 그 장 장소를 잠깐 (숨은 장은 장소 없음 → 건너뜀)
  Object.assign(S, placements(rec))
  S.reward = rec.reward
  S.cond = extra?.cond ?? battles.cond[def.n] ?? []
  S.turnEv = extra?.turn ?? battles.turn[def.n] ?? []
  S.dialogue = dialogue
  S.map = stage.map
  S.atlas = stage.atlas
  const ids = new Set([...S.allies, ...S.enemies].map(p => p.type))
  await Promise.all([...ids].map(async id => S.sprites.set(id, await loadUnitSprite(id))))
  S.floats = []
  setupScreen(ed, def)
  resize()
  if (!looping) { looping = true; requestAnimationFrame(frame) }
  await start(resume)
}

async function start(resume?: Suspended) {
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
  S.aim = S.watch = null
  if (resume) { await resumeAt(resume, all); return }
  closeAll()
  hideBasic()
  setTurn(1, null)
  setTitle(chapterTitle())
  centerOn(S.units[0])
  await fadeIn()
  if (remake()) await new Promise<void>(ok => showGoalsWin(ok))   // 장 카드 + 목표 (S2 제안 4, ux-proposal 16)
  await story('pre', S.scenes.pre[S.def.n] ?? [], aliveMember)
  await banter('start')
  if (!remake()) await goGo()   // 원작: 첫 대화 뒤 「GO!! GO!!」, 첫 클릭에 사라짐
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
        const k = Math.min(1, (performance.now() - t0) / (STEP_MS * (aiTurn && remake() && setting('fastEnemy') ? 0.35 : 1)))
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
  await sleep(120 * pace())
  a.px = a.x; a.py = a.y
  const dmg = S.ed.rules.rollDamage(S.map, a, d)
  d.hp = Math.max(0, d.hp - dmg)
  if (S.troopState[d.troop] === 1) { S.troopState[d.troop] = 0; woke.push(d.troop) }   // 경계 부대는 맞으면 깨어난다 (원작 20ec:93b5)
  d.flash = performance.now() + 160
  S.floats.push({ x: d.x, y: d.y, text: `-${dmg}`, t0: performance.now(), color: d.side === 'ally' ? '#ff8080' : '#ffffff' })
  await sleep(350 * pace())
  if (d.hp <= 0) {
    for (let i = 10; i >= 0; i--) { d.alpha = i / 10; await sleep(30 * pace()) }
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
  hideBasic()
  S.aim = null
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
    closeAll()
    hideBasic()
    if (remake()) showResult('패 배', `${fallen.type.name}이(가) 쓰러졌다.`, [['다시 하기', () => void start()], ['정비 화면', toCamp], ['타이틀로', toTitle]])
    // 원작: 패배 화면·메시지 없이 어두워졌다가 1장 정비 화면 (초기 일행, formats "기본 패배"). 장 선택으로 연 장은 그 장 처음부터
    else if (S.def.campaign) void boot(S.ed, stageDef(1, 0, true), { flags: [], party: [], items: [] })
    else void start()
    return true
  }
  const prev = S.mode
  if (result) { S.mode = { kind: 'busy' }; await sleep(400) }
  const won = result === 'win' || result === 'ending'
  const moments = scriptMoments()
  const bossTalk = !result && bossHit()
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

/** 조건 창: 원작 승리·실패 조건 (+ 개선판 장 카드 목표·보조 목표) */
function showGoalsWin(onClose?: () => void) {
  const card = chapter()?.card
  showConditions({ title: remake() ? (card ? `${S.def.n}장 · ${card[0]}` : S.def.title) : '', goal: remake() ? card?.[1] : undefined,
    goals: remake() ? goalStates(aliveMember) : undefined, onClose })
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
  const extraNext = S.ed.extraBattles?.[def.n]?.next
  const onward = extraNext ? () => void boot(S.ed, stageDef(extraNext, 0))
    : def.campaign && next ? ('n' in next ? () => go(next.n, next.route) : () => void chooseRoute().then(r => go(next.choose[r], r)))
    : null
  if (!remake()) {
    // 원작: 결과 창 없이 장 후 대화 → (진로선택) → 다음 장 정비 화면. 장 선택으로 연 장·엔딩만 짧게 묻는다
    if (onward) { onward(); return }
    showResult(ending ? '엔 딩' : '승 리', ending ? '' : `${def.title}`, [['다시 하기', () => void start()], ['타이틀로', toTitle]])
    return
  }
  const fallen = S.units.filter(u => u.troop === 0 && u.hp <= 0).map(u => u.type.name)
  const goals = goalStates(aliveMember)
  const lines = [`${S.turn}턴 만에 클리어${ending ? ' — 엔딩' : ''}`, fallen.length ? `쓰러진 동료: ${fallen.join(', ')}` : '쓰러진 동료 없음',
    ...goals.length ? [`보조 목표 ${goals.filter(g => g.state === 'done').length} / ${goals.length}`] : []]
  const buttons: Btn[] = []
  if (onward) buttons.push(['다음 장', onward])
  buttons.push(['다시 하기', () => void start()], ['타이틀로', toTitle])
  showResult(ending ? '엔 딩' : '승 리', lines.join('\n'), buttons)
}

/** 진로선택 (원작 comma 창, 0aa2:0b0d: 암흑동굴·혼탁한호수·옛 신전 순). 개선판은 버튼마다 그 길의 목적을 설명 칸에 보이고 결정·취소로 확인 */
export function chooseRoute(): Promise<number> {
  const order = S.ed.routeOrder ?? [0, 1, 2]
  const places = S.ed.routePlaces ?? S.ed.routeLabels
  return new Promise(ok => {
    const open = () => {
      const hint = '어느 길로 갈까?'
      const el = openWin({ title: '진로선택', kind: 'route', at: 'center', btnW: 112,
        body: remake() ? `<span class="hint">${hint}</span>` : undefined, bodyH: remake() ? 40 : undefined, width: remake() ? Math.min(view.w - 160, 300) : undefined,
        buttons: order.map((r): Btn => [places[r], () => remake() ? confirmWin('진로선택', 'center', () => ok(r), open, esc(S.ed.routeLabels[r]), 260) : ok(r)]) })
      if (!remake()) return
      const box = el.querySelector<HTMLElement>('.hint')!
      el.querySelectorAll<HTMLButtonElement>('.obtn').forEach((b, i) => {
        b.onmouseenter = b.onfocus = () => { box.textContent = S.ed.routeLabels[order[i]] }
        b.onmouseleave = () => { box.textContent = hint }
      })
    }
    open()
  })
}

// ---------- 턴 ----------

let phase: { side: 'ally' | 'enemy' | 'npc' | null; who: string } = { side: null, who: '' }
function updatePhase(side = phase.side, who = phase.who) {
  phase = { side, who }
  setTurn(S.turn, side, who)
  setDisabled('end', S.mode.kind === 'busy' || !stepDone)
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
}

/** 라운드 반복. 판의 order() 가 준 행동 단계를 차례로 실행한다 (원작판 = 한 명씩, 개선판 = 페이즈제). 전투가 끝나면 돌아온다.
 *  원작: 턴·차례 알림 없음 (띠는 장 제목만). 개선판: 띠의 턴 패 + 아군 차례 시작마다 「GO!! GO!!」 */
async function runRounds(resumed = false) {
  for (;;) {
    if (!resumed) {
      for (const u of S.units) { u.acted = false; u.moved = false; u.steps = 0 }
      S.mode = { kind: 'busy' }
      await turnEvents()
    }
    resumed = false
    for (const step of S.ed.order([...S.units, ...S.reserve], S.turn)) {
      const live = step.filter(u => u.hp > 0 && S.units.includes(u))
      if (!live.length) continue
      const lead = live[0], party = lead.troop === 0
      const side = party ? 'ally' : isNpc(lead) ? 'npc' : 'enemy'
      if (party && live.every(u => u.acted)) continue   // 중단 저장에서 이어 온 턴: 이미 마친 단계
      updatePhase(side, step.length > 1 ? '' : lead.type.name)
      if (party && step.length > 1) await goGo(900)
      if (await (party ? playerStep(live) : aiStep(step))) return
    }
    S.turn++
  }
}

// 플레이어 단계: 단계의 일행 대원이 모두 행동하거나 턴 종료(원작판은 휴식)를 누를 때까지
let stepDone: ((over: boolean) => void) | null = null
function playerStep(units: Unit[]): Promise<boolean> {
  return new Promise(ok => {
    S.active = units
    stepDone = over => { stepDone = null; S.active = []; updatePhase(); ok(over) }
    S.mode = { kind: 'idle' }
    if (units.length === 1) {
      centerOnIfOff(units[0])
      if (remake()) select(units[0])   // 원작판은 유닛을 눌러 명령부터 고른다
    }
    updatePhase()
  })
}

export function endPlayerStep() {
  if (S.mode.kind === 'busy' || !stepDone) return
  cancel()
  closeAll()
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
  aiTurn = true
  try { return await aiSteps(units) } finally { aiTurn = false }
}
async function aiSteps(units: Unit[]): Promise<boolean> {
  for (const u of units) {
    if (u.hp <= 0 || !S.units.includes(u)) continue
    const plan = S.ed.planFor(S.map, S.units, u, S.troopState)
    if (plan.rest) { rest(u); continue }
    const path = pathTo(reachable(S.map, S.units, u), plan.dest.x, plan.dest.y)
    const acts = path.length > 1 || (plan.target && plan.target.hp > 0)
    if (acts && units.length === 1) updatePhase(phase.side, u.type.name)
    if (path.length > 1) { centerOnIfOff(u); await walk(u, path) }
    const hits = !!plan.target && plan.target.hp > 0
    if (hits) { centerOnIfOff(u); await attack(u, plan.target!) }
    tire(u, hits)
    if (await checkEnd()) return true
  }
  return false
}

// ---------- 화면 (띠·미니맵) ----------

/** 장 이름: 개선판은 장 카드 장소 ("3장 · 지하 신전") */
function chapterTitle() {
  const card = chapter()?.card
  return S.ed.id === 'remake' && card && !S.ed.extraBattles?.[S.def.n] ? `${S.def.n}장 · ${card[0]}` : S.def.title
}

const remake = () => !S.ed.features.commandFirst

/** 장마다: 논리 화면 크기 (개선판 = 창에 맞춰 넓게), 띠 버튼, 미니맵 */
function setupScreen(ed: Edition, def: StageDef) {
  layout(ed.id === 'remake')
  canvas.style.cursor = `url(${pieceUrl('sta.0')}) 2 2, default`   // 원작 커서 = 날개 지팡이 (STA 0)
  S.marks = true
  S.threat = false
  initBand(ed.id === 'remake', [
    { id: 'goal', label: '목표', desc: '승리·실패 조건과 보조 목표', side: 'left', prio: 2, on: () => showGoalsWin() },
    { id: 'end', label: '턴 종료', desc: '아군 차례를 마친다 (E)', side: 'right', prio: 0, on: endPlayerStep },
    { id: 'menu', label: '메뉴', desc: '시스템 메뉴 (설정·정비 화면·타이틀)', side: 'right', prio: 0, on: () => systemMenu() },
    { id: 'threat', label: '위험', desc: '적이 닿을 수 있는 범위 표시 (T)', side: 'right', prio: 1, on: toggleThreat },
    { id: 'map', label: '지도', desc: '미니맵 켜고 끄기 (M)', side: 'right', prio: 3, on: toggleMinimap },
  ], goBack)
  if (ed.id === 'remake') { initMinimap(); setOn('map', minimapOn()) } else removeMinimap()
}

export function toggleThreat() {
  if (!remake()) return
  S.threat = !S.threat
  setOn('threat', S.threat)
}
export function toggleMinimap() {
  if (!remake()) return
  const on = !minimapOn()
  setMinimap(on)
  setOn('map', on)
}

/** 중단 (개선판): 아군 차례 중 지금 상태를 저장하고 타이틀로. 이어하기는 그 턴 아군 차례부터 */
function suspend() {
  if (!stepDone || S.mode.kind === 'busy') return
  cancel()
  const all = [...S.units, ...S.reserve].sort((a, b) => a.uid - b.uid)
  writeSuspended(S.ed.id, {
    def: S.def, title: chapterTitle(), at: atStart, deploy: S.deploy, turn: S.turn,
    units: all.map(u => ({ x: u.x, y: u.y, hp: u.hp, fatigue: u.fatigue, acted: u.acted, moved: u.moved, steps: u.steps, facing: u.facing, alpha: u.alpha, onMap: S.units.includes(u) })),
    troopState: S.troopState, fired: [...S.fired], told: [...told], joined: S.joined, flags: [...FLAGS], saved: Date.now(),
  })
  toTitle()
}

/** 중단 저장에서 이어 하기: 유닛·부대·발동 기록을 되돌리고 그 턴 아군 차례부터 */
async function resumeAt(r: Suspended, all: Unit[]) {
  writeSuspended(S.ed.id, null)   // 한 번 불러오면 지운다
  all.forEach((u, i) => { const v = r.units[i]; if (!v) return; const { onMap: _, ...rest } = v; Object.assign(u, rest, { px: v.x, py: v.y }) })
  S.units = all.filter((_, i) => r.units[i]?.onMap ?? true)
  S.reserve = all.filter((_, i) => r.units[i] && !r.units[i].onMap)
  S.troopState = [...r.troopState]
  r.fired.forEach(i => S.fired.add(i))
  r.told.forEach(t => told.add(t))
  S.joined = [...r.joined]
  FLAGS.clear(); r.flags.forEach(f => FLAGS.add(f))
  S.turn = r.turn
  closeAll()
  hideBasic()
  setTitle(chapterTitle())
  centerOn(S.units.find(u => u.troop === 0 && u.hp > 0 && !u.acted) ?? S.units[0])
  await fadeIn()
  await runRounds(true)
}

/** 전투를 그만두고 이 장 정비 화면으로 (원작 시스템 → 종료 「대기화면」) */
function toCamp() {
  S.mode = { kind: 'busy' }
  closeAll()
  hideBasic()
  void boot(S.ed, S.def, atStart)
}

/** 시스템 창. 원작: 알림·표기·음악·음향·조건·종료. 개선판: 목표·위험 범위·지도·표기·턴 종료·정비 화면·타이틀로 */
function systemMenu(at?: { x: number; y: number }) {
  const onOff = (title: string, set?: (on: boolean) => void) => () =>
    openWin({ title, dir: 'row', btnW: 54, kind: 'sub', at: 'center', buttons: [['열기', () => set?.(true)], ['닫기', () => set?.(false)]], onBack: () => closeWin('sub') })
  const items: Btn[] = remake() ? [
    ['목표', () => showGoalsWin()],
    [`위험 ${S.threat ? '끄기' : '켜기'}`, toggleThreat],
    [`지도 ${minimapOn() ? '끄기' : '켜기'}`, toggleMinimap],
    [`표기 ${S.marks ? '끄기' : '켜기'}`, () => { S.marks = !S.marks }],
    ['턴 종료', endPlayerStep, { disabled: !stepDone || S.mode.kind === 'busy' }],
    ['정비 화면', () => confirmWin('대기화면', 'center', toCamp)],
    ['중단', () => confirmWin('중단', 'center', suspend, () => {}, '지금 상태를 저장하고 타이틀로.<br>지난흔적에서 이어 합니다.', 200), { disabled: !stepDone || S.mode.kind === 'busy' }],
    ['타이틀로', () => confirmWin('주화면', 'center', toTitle)],
  ] : [
    ['알림', onOff('알림전환')],   // 무엇을 켜고 끄는지 미확인 (ux.md 6절) — 창만
    ['표기', () => { S.marks = !S.marks; closeWin('system') }],
    ['음악', onOff('음악전환')],
    ['음향', onOff('음향전환')],
    ['조건', () => showGoalsWin()],
    ['종료', () => confirmWin('대기화면', 'center', toCamp)],
  ]
  openWin({ title: '시스템', buttons: items, kind: 'system', at: at ?? 'center', btnW: remake() ? 96 : 64,
    closeOnPick: !!remake(), onBack: () => closeWin('system') })
}

// ---------- 플레이어 명령 ----------

/** 유닛 오른쪽 옆 (원작: 창은 누른 유닛 오른쪽에 뜬다) */
const beside = (u: Pos) => { const { sx, sy } = toScreen(u.x + 1, u.y); return { x: sx + 4, y: sy } }

export function select(u: Unit) {
  S.mode = { kind: 'selected', unit: u, moves: reachable(S.map, S.units, u) }
}

/** 행동 전이면 이동 취소 (원위치) */
function undoMove(u: Unit, from: Pos) {
  u.x = u.px = from.x
  u.y = u.py = from.y
  u.moved = false
  u.steps = 0
}

export function cancel() {
  const md = S.mode
  hideMenu()
  S.aim = null
  if (md.kind === 'moved' || md.kind === 'targeting') { undoMove(md.unit, md.from); select(md.unit) }
  else if (md.kind === 'selected') S.mode = { kind: 'idle' }
}

/** 맵 칸 클릭 (창이 떠 있지 않을 때) */
export async function clickTile(t: Pos) {
  const md = S.mode
  const there = unitAt(t.x, t.y)
  if (md.kind === 'busy') return
  hideBasic()
  if (!remake()) {
    // 원작판
    if (md.kind === 'idle') {
      if (there && canCommand(there)) commandMenu(there)
      else if (there) showBasic(there, aboveUnit(toScreen(there.x, there.y).sx, toScreen(there.x, there.y).sy), { onFace: () => bigStatus(there) })   // 다른 유닛 = 작은 인물기본자료
      return
    }
    if (md.kind === 'selected') {   // 범위 밖 칸은 무시
      if (md.moves.has(key(t.x, t.y)) || there === md.unit) await moveTo(md.unit, t)
      return
    }
    if (md.kind === 'targeting' && there?.side === 'enemy' && inRange(md.unit, md.unit, there)) askAttack(md.unit, there)
    return
  }
  // 개선판
  if (md.kind === 'idle') {
    if (there && canCommand(there)) select(there)
    else if (there?.side === 'enemy') S.watch = S.watch === there ? null : there   // 그 적의 위협 범위
    return
  }
  if (md.kind === 'selected') {
    const u = md.unit
    if (there === u) { actionMenu(u, { x: u.x, y: u.y }); return }
    if (there && canCommand(there)) { select(there); return }
    if (there?.side === 'enemy' && S.ed.features.quickAttack) {
      // 이동 + 공격을 한 번에: 대상에 닿는 칸 중 가장 가까운 곳으로 (확인창 결정 뒤)
      const spots = attackSpots(u, md.moves, there).sort((a, b) => dist(a, u) - dist(b, u))
      if (spots.length) { askAttack(u, there, spots[0], md.moves); return }
      S.watch = S.watch === there ? null : there
      return
    }
    if (md.moves.has(key(t.x, t.y))) { await moveTo(u, t); return }
    S.mode = { kind: 'idle' }
    return
  }
  if (md.kind === 'targeting' && there?.side === 'enemy' && inRange(md.unit, md.unit, there)) askAttack(md.unit, there)
}

async function moveTo(u: Unit, t: Pos) {
  const md = S.mode
  if (md.kind !== 'selected') return
  const from = { x: u.x, y: u.y }
  S.mode = { kind: 'busy' }
  await walk(u, pathTo(md.moves, t.x, t.y))
  actionMenu(u, from)
}

/** 마우스 올림. 개선판: 유닛 옆 작은 인물기본자료 (+ 이름·지형) · 아래 띠 지형 패. 원작: 아무것도 */
export function hoverTile(t: Pos | null) {
  S.hover = t
  if (!remake()) return
  setTerrain(t ? terrainName(S.map, t.x, t.y) : null)
  const there = t && unitAt(t.x, t.y)
  if (!there || S.mode.kind === 'busy' || modalOpen()) { hideBasic(); return }
  const { sx, sy } = toScreen(there.x, there.y)
  showBasic(there, aboveUnit(sx, sy, 112), { extra: true })
}

/** 「전 투」 확인 (원작 DS:0x1f72). 개선판은 피해 예측을 창에 넣는다. spot = 개선판 이동+공격 때 설 칸 */
function askAttack(u: Unit, target: Unit, spot?: Pos, moves?: ReturnType<typeof reachable>) {
  S.aim = { x: target.x, y: target.y }
  hideBasic()
  let body: string | undefined
  if (S.ed.features.forecast) {
    const [lo, hi] = S.ed.rules.damageRange(S.map, u, target, spot ?? u)
    const span = (a: number, b: number) => a === b ? `${a}` : `${a}~${b}`
    const kill = lo >= target.hp ? '<span class="red">확정 처치</span>' : hi >= target.hp ? '<span class="red">처치 가능</span>' : ''
    body = [`${esc(target.type.name)}`, `피해 ${span(lo, hi)}`, `남는 생명 ${span(Math.max(0, target.hp - hi), Math.max(0, target.hp - lo))}/${target.maxHp}`, kill].filter(Boolean).join('<br>')
  }
  const { sx, sy } = toScreen(target.x + 1, target.y)
  const go = () => {
    S.aim = null
    void (async () => {
      if (spot && moves) {
        const from = { x: u.x, y: u.y }
        S.mode = { kind: 'busy' }
        await walk(u, pathTo(moves, spot.x, spot.y))
        S.mode = { kind: 'targeting', unit: u, from }
      }
      await doAttack(u, target)
    })()
  }
  if (remake() && setting('quickAttack')) { go(); return }   // 개선판 설정: 확인 생략
  confirmWin('전 투', { x: sx + 4, y: sy }, go, () => { S.aim = null }, body)
}

/** 원작판: 차례인 유닛을 누르면 여는 명령창 「명령」 (원작 20ec:eb81): 이동·전투·상황·시스템 (마법은 마법 구현 때) */
export function commandMenu(u: Unit) {
  const here = { x: u.x, y: u.y }
  S.mode = { kind: 'idle' }
  showMenu([
    ['이동', () => select(u)],
    ['전투', () => { S.mode = { kind: 'targeting', unit: u, from: here } }],   // 원작: 사거리에 적이 없어도 들어간다
    ['상황', () => { const p = beside(u); showBasic(u, { x: p.x, y: p.y }, { onFace: () => bigStatus(u) }) }],
    ['시스템', () => systemMenu(beside(u))],
  ], beside(u).x, beside(u).y)
}

/** 큰 인물기본자료 (원작: 작은 창의 얼굴 아이콘 → 정비 화면 상태창과 같은 창) — 정비 화면 상태창을 맵 가운데에 */
function bigStatus(u: Unit) {
  hideBasic()
  void import('./camp').then(m => m.statusWindow(u.type, S.tables, { hp: u.hp, fatigue: u.fatigue }))
}

/** 휴식 확인 「휴식」 (원작 DS:0x1f64, 20ec:c25c: 결정 → 회복하고 차례 끝). 원작판: 창이 없을 때 오른쪽 클릭 */
export function restPrompt() {
  if (S.mode.kind === 'busy' || !stepDone) return
  const u = S.active.find(a => !a.acted && a.hp > 0)
  if (!u) return
  if (S.mode.kind === 'moved' || S.mode.kind === 'targeting') cancel()
  hideMenu()
  S.mode = { kind: 'idle' }
  confirmWin('휴 식', beside(u), () => { rest(u); finishUnit(u) })
}

/** 오른쪽 클릭·Esc (창이 처리하지 않았을 때). 원작: 공격 범위·이동 범위 → 명령창, 아무것도 없으면 「휴식」. 개선판: 한 단계 취소 */
export function back() {
  const md = S.mode
  hideBasic()
  if (md.kind === 'busy') return
  if (!remake()) {
    if (md.kind === 'targeting') { if (md.unit.x !== md.from.x || md.unit.y !== md.from.y) actionMenu(md.unit, md.from); else commandMenu(md.unit); return }
    if (md.kind === 'selected') { commandMenu(md.unit); return }
    if (md.kind === 'idle') restPrompt()
    return
  }
  if (md.kind === 'targeting') { actionMenu(md.unit, md.from); return }
  if (md.kind === 'selected') { S.mode = { kind: 'idle' }; return }
  if (md.kind === 'idle') S.watch = null
}

/** 이동 뒤 명령. 원작: 전투·결정·취소 (취소 = 제자리로 + 명령창 다시). 개선판: 공격(적이 닿으면)·대기·취소 (취소 = 이동 범위 다시) */
export function actionMenu(u: Unit, from: Pos) {
  S.mode = { kind: 'moved', unit: u, from }
  const undo = () => { undoMove(u, from); if (remake()) select(u); else commandMenu(u) }
  const targets = alive('enemy').filter(e => inRange(u, u, e))
  const items: Btn[] = remake()
    ? [...targets.length ? [['공격', () => { S.mode = { kind: 'targeting', unit: u, from } }] as Btn] : [], ['대기', () => finishUnit(u)], ['취소', undo]]
    : [['전투', () => { S.mode = { kind: 'targeting', unit: u, from } }], ['결정', () => finishUnit(u)], ['취소', undo]]
  const p = beside(u)
  showMenu(items, p.x, p.y, remake() ? '행동' : '명령', () => { closeWin('menu'); undo() })
}

export async function doAttack(u: Unit, target: Unit) {
  S.mode = { kind: 'busy' }
  hideMenu()
  hideBasic()
  await attack(u, target)
  finishUnit(u, true)
}

/** 오른쪽 클릭·Esc 입구: 떠 있는 창 → 맵 순서 */
export function goBack() {
  if (!winBack()) back()
}
