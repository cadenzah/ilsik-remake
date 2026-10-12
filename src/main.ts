import { loadBattles, loadDialogue, loadScenes, loadStage, loadTables, loadUnitSprite, TH, TW, type BattleRecord, type CondDo, type CondIf, type CondRule, type Member, type TurnEvent, type Scenes, type StageMap, type Tables, type UnitType } from './data'
import { planFor } from './ai'
import { attackSpots, dist, equippedStats, inRange, key, pathTo, reachable, rollDamage, terrainName, type Moves, type Pos, type Unit } from './rules'
import { stage01, type Placement, type StageDef } from './stages/stage01'
import { hideMenu, playDialogue, showCard, showForecast, showMenu, showResult, toast, ui } from './ui'

const canvas = document.getElementById('view') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

// 이동 프레임: 0~2 아래, 3~4 위, 5~6 왼쪽, 7~8 오른쪽
const FRAMES = { down: [0, 1, 2, 1], up: [3, 4], left: [5, 6], right: [7, 8] } as const
const STEP_MS = 110

type Mode =
  | { kind: 'busy' }
  | { kind: 'idle' }
  | { kind: 'selected'; unit: Unit; moves: Moves }
  | { kind: 'moved'; unit: Unit; from: Pos }
  | { kind: 'targeting'; unit: Unit; from: Pos }

// ?stage=N&route=R 로 다른 장 배치를 시험할 수 있다 (진행은 아직 1장 기준)
function pickStage(): StageDef {
  const q = new URLSearchParams(location.search), n = Number(q.get('stage'))
  if (!n || n === 1) return stage01
  return { n, title: `${n}장`, route: Number(q.get('route') ?? 0) }
}

const S = {
  def: pickStage(),
  allies: [] as Placement[],
  enemies: [] as Placement[],
  troopInit: [] as number[],   // 부대별 초기 상태 (+0x235)
  troopState: [] as number[],
  cond: [] as CondRule[],
  turnEv: [] as TurnEvent[],
  fired: new Set<number>(),    // 이미 발동한 규칙 번호
  reserve: [] as Unit[],       // 상태 4 (숨김) 부대 대원. 상태가 바뀌면 맵에 나온다
  map: null as unknown as StageMap,
  atlas: null as unknown as HTMLImageElement,
  types: [] as UnitType[],
  tables: null as unknown as Tables,
  dialogue: [] as string[],
  scenes: null as unknown as Scenes,
  sprites: new Map<number, HTMLImageElement>(),
  units: [] as Unit[],
  turn: 1,
  mode: { kind: 'busy' } as Mode,
  hover: null as Pos | null,
  threat: false,
  cam: { x: 0, y: 0, scale: 1 },
  floats: [] as { x: number; y: number; text: string; t0: number; color: string }[],
}

// ---------- 초기화 ----------

let uidSeq = 0
function spawn(p: Placement, side: Unit['side']): Unit {
  const t = S.types[p.type]
  const st = equippedStats(t, S.tables.items)
  if (S.troopInit[p.troop] === 3) st.mov = 0   // 상태 3 = 제자리 고정 (원작 124e:1d41, 전투 로드 때만)
  return {
    uid: uidSeq++, type: t, side, troop: p.troop, member: p.member, x: p.x, y: p.y, hp: st.maxHp, ...st,
    range: weaponRange(t), acted: false,
    facing: side === 'ally' ? 'left' : 'right', px: p.x, py: p.y, alpha: 1, flash: 0,
  }
}

// 무기 f2: 1 근접, 2~3 원거리 (formats.md 추정)
function weaponRange(t: UnitType): [number, number] {
  const f2 = S.tables.items.get(t.equip[0])?.f2 ?? 1
  return f2 >= 2 ? [1, f2] : [1, 1]
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

async function boot() {
  const [tables, dialogue, stage, battles, scenes] = await Promise.all([loadTables(), loadDialogue(), loadStage(S.def.n), loadBattles(), loadScenes()])
  S.tables = tables
  S.scenes = scenes
  const rec = battles.records[`${S.def.n}-${S.def.route}`] ?? battles.records[[0, 1, 2].map(r => `${S.def.n}-${r}`).find(k => k in battles.records)!]
  Object.assign(S, placements(rec))
  S.cond = battles.cond[S.def.n] ?? []
  S.turnEv = battles.turn[S.def.n] ?? []
  S.types = tables.types
  S.dialogue = dialogue
  S.map = stage.map
  S.atlas = stage.atlas
  const ids = new Set([...S.allies, ...S.enemies].map(p => p.type))
  await Promise.all([...ids].map(async id => S.sprites.set(id, await loadUnitSprite(id))))
  ui.title.textContent = S.def.title
  resize()
  requestAnimationFrame(frame)
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
  S.mode = { kind: 'busy' }
  centerOn(S.units[0])
  await playDialogue(sceneLines(S.scenes.pre[S.def.n] ?? []))
  await beginPlayerTurn()
}

// ---------- 원작 대화 ----------

// 선택지 분기는 아직 UI 가 없어 '예'(1) 쪽을 재생한다
function sceneLines(keys: string[]) {
  return keys.flatMap(k => S.scenes.scenes[k] ?? []).filter(([, , br]) => br !== 2)
    .map(([who, line]) => ({ who: who >= 0 ? S.types[who] : undefined, text: S.dialogue[line] }))
}

// 승리 후 장면. 원작은 합류 처리 뒤 대화를 띄우지만 알림은 대화 끝에 보여 준다
function postLines(stage: number) {
  const steps = S.scenes.post[stage] ?? []
  return [...sceneLines(steps.flatMap(s => 'scene' in s ? [s.scene] : [])),
    ...steps.flatMap(s => 'join' in s && (!s.flag || FLAGS.has(s.flag)) ? [{ text: `${S.types[s.join].name}이(가) 일행에 합류했다.` }] : [])]
}

// ---------- 카메라 ----------

function resize() {
  const dpr = devicePixelRatio || 1
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  const fit = Math.min(innerWidth / (S.map.w * TW), (innerHeight - 40) / (S.map.h * TH))
  S.cam.scale = Math.max(0.6, Math.min(1.5, fit < 1 ? Math.max(fit, 0.75) : 1))
  clampCam()
}
addEventListener('resize', () => S.map && resize())

function clampCam() {
  const vw = innerWidth / S.cam.scale, vh = (innerHeight - 40) / S.cam.scale
  const mw = S.map.w * TW, mh = S.map.h * TH
  S.cam.x = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, S.cam.x))
  S.cam.y = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, S.cam.y))
}

function centerOn(p: Pos) {
  S.cam.x = p.x * TW + TW / 2 - innerWidth / S.cam.scale / 2
  S.cam.y = p.y * TH + TH / 2 - (innerHeight - 40) / S.cam.scale / 2
  clampCam()
}

const toScreen = (x: number, y: number) => ({
  sx: (x * TW - S.cam.x) * S.cam.scale, sy: (y * TH - S.cam.y) * S.cam.scale + 40,
})
function toTile(cx: number, cy: number): Pos | null {
  const x = Math.floor((cx / S.cam.scale + S.cam.x) / TW)
  const y = Math.floor(((cy - 40) / S.cam.scale + S.cam.y) / TH)
  return x >= 0 && y >= 0 && x < S.map.w && y < S.map.h ? { x, y } : null
}

// ---------- 렌더 ----------

const unitAt = (x: number, y: number) => S.units.find(u => u.hp > 0 && u.x === x && u.y === y)
const alive = (side: Unit['side']) => S.units.filter(u => u.hp > 0 && u.side === side)
// 플레이어가 조종하는 건 일행(부대 0)뿐. NPC 부대는 같은 편이지만 컴퓨터가 움직인다 (원작 +0x237: 일행 0, NPC 1, 적 2 → 2ff8:0ea0)
const isNpc = (u: Unit) => u.side === 'ally' && u.troop !== 0
const party = () => S.units.filter(u => u.hp > 0 && u.troop === 0)
const canCommand = (u: Unit) => u.troop === 0 && u.hp > 0 && !u.acted

function threatTiles(): Set<number> {
  const out = new Set<number>()
  for (const e of alive('enemy')) {
    for (const k of reachable(S.map, S.units, e).keys()) {
      const x = k % 1000, y = Math.floor(k / 1000)
      for (let dy = -e.range[1]; dy <= e.range[1]; dy++)
        for (let dx = -e.range[1]; dx <= e.range[1]; dx++) {
          const d = Math.abs(dx) + Math.abs(dy)
          if (d >= e.range[0] && d <= e.range[1]) out.add(key(x + dx, y + dy))
        }
    }
  }
  return out
}

function frame(now: number) {
  const dpr = devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#0d0f14'
  ctx.fillRect(0, 0, innerWidth, innerHeight)

  const sc = S.cam.scale
  ctx.save()
  ctx.translate(0, 40)
  ctx.scale(sc, sc)
  ctx.translate(-S.cam.x, -S.cam.y)

  // 타일
  const m = S.map
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const t = m.tiles[y * m.w + x]
      ctx.drawImage(S.atlas, (t % m.atlasCols) * TW, Math.floor(t / m.atlasCols) * TH, TW, TH, x * TW, y * TH, TW, TH)
    }

  // 격자
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1 / sc
  ctx.beginPath()
  for (let x = 0; x <= m.w; x++) { ctx.moveTo(x * TW, 0); ctx.lineTo(x * TW, m.h * TH) }
  for (let y = 0; y <= m.h; y++) { ctx.moveTo(0, y * TH); ctx.lineTo(m.w * TW, y * TH) }
  ctx.stroke()

  const fill = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * TW + 1, y * TH + 1, TW - 2, TH - 2) }

  if (S.threat) for (const k of threatTiles()) fill(k % 1000, Math.floor(k / 1000), 'rgba(255,50,50,0.32)')

  const md = S.mode
  if (md.kind === 'selected') {
    for (const k of md.moves.keys()) fill(k % 1000, Math.floor(k / 1000), 'rgba(80,140,255,0.38)')
    for (const e of alive('enemy')) if (attackSpots(md.unit, md.moves, e).length) fill(e.x, e.y, 'rgba(255,70,70,0.45)')
    if (S.hover && md.moves.has(key(S.hover.x, S.hover.y))) {
      const path = pathTo(md.moves, S.hover.x, S.hover.y)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 4
      ctx.beginPath()
      path.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p.x * TW + TW / 2, p.y * TH + TH / 2))
      ctx.stroke()
    }
  }
  if (md.kind === 'targeting')
    for (const e of alive('enemy')) if (inRange(md.unit, md.unit, e)) fill(e.x, e.y, 'rgba(255,70,70,0.5)')

  // 유닛 (y 순으로 그려 겹침 자연스럽게)
  const sorted = S.units.filter(u => u.alpha > 0).sort((a, b) => a.py - b.py)
  for (const u of sorted) {
    const x = u.px * TW, y = u.py * TH
    ctx.globalAlpha = u.alpha
    // 진영 표시 받침
    ctx.fillStyle = isNpc(u) ? 'rgba(90,210,140,0.55)' : u.side === 'ally' ? 'rgba(79,140,255,0.55)' : 'rgba(255,90,90,0.55)'
    ctx.beginPath()
    ctx.ellipse(x + TW / 2, y + TH - 6, 20, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    const seq = FRAMES[u.facing]
    const moving = u.px !== u.x || u.py !== u.y
    const f = u.acted && u.side === 'ally' ? seq[0] : seq[Math.floor(now / (moving ? 120 : 380)) % seq.length]
    const img = S.sprites.get(u.type.id)
    if (img) {
      if (u.acted && u.side === 'ally') ctx.filter = 'grayscale(0.8) brightness(0.8)'
      ctx.drawImage(img, f * TW, 0, TW, TH, x, y - 4, TW, TH)
      ctx.filter = 'none'
    }
    if (u.flash > now) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.6
      ctx.drawImage(img!, f * TW, 0, TW, TH, x, y - 4, TW, TH)
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.globalAlpha = u.alpha
    // HP 막대
    ctx.fillStyle = '#000a'
    ctx.fillRect(x + 8, y + TH - 4, TW - 16, 4)
    ctx.fillStyle = u.side === 'ally' ? '#55d17a' : '#ff6b6b'
    ctx.fillRect(x + 8, y + TH - 4, ((TW - 16) * u.hp) / u.maxHp, 4)
    ctx.globalAlpha = 1
  }

  // 커서
  if (S.hover) {
    ctx.strokeStyle = '#ffe28a'
    ctx.lineWidth = 2
    ctx.strokeRect(S.hover.x * TW + 1, S.hover.y * TH + 1, TW - 2, TH - 2)
  }

  // 떠오르는 피해 숫자
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  S.floats = S.floats.filter(f => now - f.t0 < 900)
  for (const f of S.floats) {
    const k = (now - f.t0) / 900
    ctx.globalAlpha = 1 - k
    ctx.lineWidth = 4
    ctx.strokeStyle = '#000'
    ctx.strokeText(f.text, f.x * TW + TW / 2, f.y * TH - 20 * k)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x * TW + TW / 2, f.y * TH - 20 * k)
  }
  ctx.globalAlpha = 1
  ctx.restore()
  requestAnimationFrame(frame)
}

// ---------- 동작 (애니메이션 포함) ----------

const sleep = (ms: number) => new Promise(ok => setTimeout(ok, ms))

async function walk(u: Unit, path: Pos[]) {
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
  const dmg = rollDamage(a, d)
  d.hp = Math.max(0, d.hp - dmg)
  if (S.troopState[d.troop] === 1) S.troopState[d.troop] = 0   // 경계 부대는 맞으면 깨어난다 (원작 20ec:93b5)
  d.flash = performance.now() + 160
  S.floats.push({ x: d.x, y: d.y, text: `-${dmg}`, t0: performance.now(), color: d.side === 'ally' ? '#ff8080' : '#ffffff' })
  await sleep(350)
  if (d.hp <= 0) {
    for (let i = 10; i >= 0; i--) { d.alpha = i / 10; await sleep(30) }
  }
}

function finishUnit(u: Unit) {
  u.acted = true
  S.mode = { kind: 'idle' }
  hideMenu()
  showForecast(null, null)
  void checkEnd().then(over => {
    if (!over && party().every(a => a.acted)) void endPlayerTurn()
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

// 부대 상태를 바꾼다. 숨김(4)에서 풀리면 맵에 나온다. 0~3 의미는 ai.ts
function setTroop(t: number, v: number) {
  S.troopState[t] = v
  if (v === 4) return
  for (const u of S.reserve.filter(u => u.troop === t)) {
    S.reserve.splice(S.reserve.indexOf(u), 1)
    S.units.push(u)
  }
}

async function checkEnd(): Promise<boolean> {
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
      else lines.push({ text: `${S.types[d.join].name}이(가) 일행에 합류했다.` })
    }
  }
  if (!result && !enemiesLeft().length) result = 'win'
  if (result === 'lose') {
    S.mode = { kind: 'busy' }
    showResult('패배', `${fallen.type.name}이(가) 쓰러졌다.`, () => void start())
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
  if (result === 'ending') {
    showResult('엔딩', `${S.turn}턴 만에 ${S.def.title} 클리어 — 엔딩`, () => void start())
    return true
  }
  await playDialogue(postLines(S.def.n))
  showResult('승리', `${S.turn}턴 만에 ${S.def.title} 클리어 — 시험판은 여기까지입니다.`, () => void start())
  return true
}

// ---------- 턴 ----------

function updatePhase(text: string) {
  ui.phase.textContent = `턴 ${S.turn} · ${text}`
  ui.btnEnd.disabled = S.mode.kind === 'busy'
}

// 캠페인 플래그. 장 연결이 없는 동안은 켜 둔다 (npc19 = 19장 용왕 생존 → 36장 루이스 출현·합류)
const FLAGS = new Set(['npc19'])

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

async function beginPlayerTurn() {
  for (const u of S.units) u.acted = false
  S.mode = { kind: 'busy' }
  await turnEvents()
  updatePhase('아군 차례')
  await toast(`턴 ${S.turn} · 아군`, 'ally', 700)
  S.mode = { kind: 'idle' }
  updatePhase('아군 차례')
}

async function endPlayerTurn() {
  if (S.mode.kind === 'busy') return
  cancel()
  S.mode = { kind: 'busy' }
  // 원작은 라운드마다 모든 유닛을 행동 순서 키로 섞어 한 명씩 움직인다 (124e:26b7). 웹은 아직 아군 → NPC → 적 순서
  const npcs = S.units.filter(u => u.hp > 0 && isNpc(u))
  if (npcs.length) {
    updatePhase('NPC 차례')
    await toast('NPC 차례', 'npc', 600)
    if (await aiPhase(npcs)) return
  }
  updatePhase('적 차례')
  await toast('적 차례', 'enemy', 700)
  if (await aiPhase(alive('enemy'))) return
  S.turn++
  await beginPlayerTurn()
}

/** 컴퓨터 조종 유닛을 차례로 움직인다. 전투가 끝나면 true */
async function aiPhase(units: Unit[]): Promise<boolean> {
  for (const u of units) {
    if (u.hp <= 0 || !S.units.includes(u)) continue
    const plan = planFor(S.map, S.units, u, S.troopState)
    const moves = reachable(S.map, S.units, u)
    const path = pathTo(moves, plan.dest.x, plan.dest.y)
    if (path.length > 1) { centerOnIfOff(u); await walk(u, path) }
    if (plan.target && plan.target.hp > 0) { centerOnIfOff(u); await attack(u, plan.target) }
    if (await checkEnd()) return true
  }
  return false
}

function centerOnIfOff(u: Unit) {
  const { sx, sy } = toScreen(u.x, u.y)
  if (sx < 60 || sy < 100 || sx > innerWidth - 120 || sy > innerHeight - 120) centerOn(u)
}

// ---------- 입력 ----------

function select(u: Unit) {
  S.mode = { kind: 'selected', unit: u, moves: reachable(S.map, S.units, u) }
}

function cancel() {
  const md = S.mode
  hideMenu()
  showForecast(null, null)
  if (md.kind === 'moved' || md.kind === 'targeting') {
    // 행동 전이면 이동 취소 (원위치)
    md.unit.x = md.unit.px = md.from.x
    md.unit.y = md.unit.py = md.from.y
    select(md.unit)
  } else if (md.kind === 'selected') S.mode = { kind: 'idle' }
}

function actionMenu(u: Unit, from: Pos) {
  S.mode = { kind: 'moved', unit: u, from }
  const targets = alive('enemy').filter(e => inRange(u, u, e))
  const { sx, sy } = toScreen(u.x + 1, u.y)
  const items: [string, () => void][] = []
  if (targets.length) items.push(['공격', () => { hideMenu(); S.mode = { kind: 'targeting', unit: u, from } }])
  items.push(['대기', () => finishUnit(u)], ['취소', () => cancel()])
  showMenu(items, sx + 4, sy)
}

async function doAttack(u: Unit, target: Unit) {
  S.mode = { kind: 'busy' }
  hideMenu()
  showForecast(null, null)
  await attack(u, target)
  S.mode = { kind: 'idle' }
  finishUnit(u)
}

async function onClick(t: Pos) {
  const md = S.mode
  const there = unitAt(t.x, t.y)
  if (md.kind === 'busy') return
  if (md.kind === 'idle') {
    if (there && canCommand(there)) select(there)
    return
  }
  if (md.kind === 'selected') {
    const u = md.unit
    if (there === u) { actionMenu(u, { x: u.x, y: u.y }); return }
    if (there && canCommand(there)) { select(there); return }
    if (there?.side === 'enemy') {
      // 이동 + 공격을 한 번에: 대상에 닿는 칸 중 가장 가까운 곳으로
      const spots = attackSpots(u, md.moves, there).sort((a, b) => dist(a, u) - dist(b, u))
      if (!spots.length) return
      const from = { x: u.x, y: u.y }
      S.mode = { kind: 'busy' }
      await walk(u, pathTo(md.moves, spots[0].x, spots[0].y))
      S.mode = { kind: 'targeting', unit: u, from }
      await doAttack(u, there)
      return
    }
    if (md.moves.has(key(t.x, t.y))) {
      const from = { x: u.x, y: u.y }
      S.mode = { kind: 'busy' }
      await walk(u, pathTo(md.moves, t.x, t.y))
      actionMenu(u, from)
      return
    }
    S.mode = { kind: 'idle' }
    return
  }
  if (md.kind === 'targeting') {
    if (there?.side === 'enemy' && inRange(md.unit, md.unit, there)) await doAttack(md.unit, there)
  }
}

function onHover(t: Pos | null, sx: number, sy: number) {
  S.hover = t
  if (!t) { showCard(null, null); showForecast(null, null); return }
  const there = unitAt(t.x, t.y)
  showCard(there ?? null, terrainName(S.map, t.x, t.y), S.tables)
  const md = S.mode
  if (there?.side === 'enemy' && md.kind === 'selected' && attackSpots(md.unit, md.moves, there).length)
    showForecast(md.unit, there, sx, sy)
  else if (there?.side === 'enemy' && md.kind === 'targeting' && inRange(md.unit, md.unit, there))
    showForecast(md.unit, there, sx, sy)
  else showForecast(null, null)
}

let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null
canvas.addEventListener('pointerdown', e => {
  if (e.button === 2) { e.preventDefault(); cancel(); return }
  drag = { x: e.clientX, y: e.clientY, cx: S.cam.x, cy: S.cam.y, moved: false }
})
addEventListener('pointermove', e => {
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true
    if (drag.moved) {
      S.cam.x = drag.cx - dx / S.cam.scale
      S.cam.y = drag.cy - dy / S.cam.scale
      clampCam()
    }
  }
  if (e.target === canvas) onHover(toTile(e.clientX, e.clientY), e.clientX, e.clientY)
})
addEventListener('pointerup', e => {
  const d = drag
  drag = null
  if (!d || d.moved || e.target !== canvas || e.button !== 0) return
  const t = toTile(e.clientX, e.clientY)
  if (t) void onClick(t).then(() => onHover(t, e.clientX, e.clientY))
})
canvas.addEventListener('contextmenu', e => e.preventDefault())
canvas.addEventListener('wheel', e => {
  e.preventDefault()
  S.cam.scale = Math.max(0.5, Math.min(2, S.cam.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
  clampCam()
}, { passive: false })

addEventListener('keydown', e => {
  if (!ui.dialogue.hidden) return
  const k = e.key.toLowerCase()
  const pan = 48 / S.cam.scale
  if (k === 'escape') cancel()
  else if (k === 'e') void endPlayerTurn()
  else if (k === 't') toggleThreat()
  else if (k === 'arrowleft' || k === 'a') S.cam.x -= pan
  else if (k === 'arrowright' || k === 'd') S.cam.x += pan
  else if (k === 'arrowup' || k === 'w') S.cam.y -= pan
  else if (k === 'arrowdown' || k === 's') S.cam.y += pan
  else return
  clampCam()
})

function toggleThreat() {
  S.threat = !S.threat
  ui.btnThreat.classList.toggle('on', S.threat)
}
ui.btnThreat.onclick = toggleThreat
ui.btnEnd.onclick = () => void endPlayerTurn()

// 개발 중 브라우저에서 상태 확인·자동 테스트용
if (import.meta.env.DEV) Object.assign(window, { __game: { S, toScreen, reachable, planFor, checkEnd } })

boot().catch(err => {
  document.body.innerHTML = `<pre style="color:#f88;padding:20px">${err}\n\n자원이 없으면: .venv/bin/python -I tools/export_web.py</pre>`
})
