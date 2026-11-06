// 전투 진행 중 화면과 무관한 부분: 배치·피해·경험치·피로·승패 규칙·턴 이벤트.
// battle.ts (연출·입력) 와 tools/sim (node 밸런스 시뮬레이터) 이 함께 쓴다. 여기서는 DOM·소리·대기를 쓰지 않는다
import type { BattleRecord, CondDo, CondIf, Magic, Member, StageMap } from './data'
import type { LevelUp } from './edition'
import { FLAGS, ITEMS, PARTY, partyType, keepGrowth, joinLine } from './campaign'
import { DIRS, inside, key, moveCost } from './grid'
import { attackKind, inReach, strikeTargets } from './attack'
import { applyHit, hitText, spellTargets } from './magic'
import type { Placement } from './stage'
import { member, S } from './state'
import { equippedStats, nextUpgrade, refit, type Pos, type Unit } from './unit'

let uidSeq = 0

/** 지금 장의 판 조정 (장-루트가 장보다 먼저). 숨은 장은 없음 */
export const stageTune = () => S.ed.extraBattles?.[S.def.n] ? undefined : S.ed.tune?.[`${S.def.n}-${S.def.route}`] ?? S.ed.tune?.[S.def.n]

export function spawn(p: Placement, side: Unit['side']): Unit {
  const t = p.troop === 0 ? partyType(p.type) : S.types[p.type]   // 일행은 정비 화면에서 바꾼 장비로
  const st = equippedStats(t, S.tables.items)
  if (S.troopInit[p.troop] === 3) st.mov = 0   // 상태 3 = 제자리 고정 (원작 124e:1d41, 전투 로드 때만)
  const k = side === 'enemy' ? stageTune()?.foeScale : undefined
  if (k) for (const f of ['maxHp', 'atk', 'def', 'spi', 'agi'] as const) st[f] = Math.max(1, Math.round(st[f] * k))
  if (side === 'enemy' && S.ed.foeHp) st.maxHp = Math.max(1, Math.round(st.maxHp * S.ed.foeHp))
  const h = side === 'ally' && p.troop !== 0 ? stageTune()?.npcHp : undefined
  if (h) st.maxHp = Math.round(st.maxHp * h)
  return {
    uid: uidSeq++, type: t, side, troop: p.troop, member: p.member, x: p.x, y: p.y, hp: st.maxHp, ...st, fatigue: (p.troop === 0 ? S.ed.startFatigue?.(t) : undefined) ?? t.fatigue, steps: 0,
    range: S.ed.rules.weaponRange(t, S.tables.items), acted: false, moved: false,
    base: { atk: st.atk, def: st.def, spi: st.spi, agi: st.agi }, mods: { atk: 0, def: 0, spi: 0, agi: 0 }, poison: 0, coma: 0, ticked: false,
    facing: side === 'ally' ? 'left' : 'right', px: p.x, py: p.y, alpha: 1, flash: 0,
  }
}

// 부대 순서 = 0 일행, (npc 있으면) 1 npc, 이후 적 무리 — 원작 부대 배열과 같게 번호를 매긴다 (formats.md "전투 승패 조건")
export function placements(rec: BattleRecord, map: StageMap) {
  // 출전 대원 = 고른 일행 인덱스 순서대로 출전 칸에
  const allies: Placement[] = S.deploy.map((k, i) => ({ type: PARTY[k], x: rec.slots[i][0], y: rec.slots[i][1], troop: 0, member: i }))
  const troopInit = [0]
  if (rec.npc.length) troopInit.push(rec.npcState)
  rec.npc.forEach((n, i) => allies.push({ type: n.type, x: n.at[0], y: n.at[1], troop: 1, member: i }))
  const base = troopInit.length
  const enemies: Placement[] = rec.groups.flatMap((g, k) =>
    g.units.map((u, i) => ({ type: u.type, x: u.at[0], y: u.at[1], troop: base + k, member: i })))
  troopInit.push(...rec.groups.map(g => g.active))
  for (const [t, v] of Object.entries(stageTune()?.troop ?? {})) troopInit[Number(t)] = v
  const gone = stageTune()?.remove ?? []
  const kept = enemies.filter(p => !gone.some(([t, m]) => t === p.troop && m === p.member))
  unstack([...allies, ...kept], map)
  return { allies, enemies: kept, troopInit }
}

/** 원작 배치가 한 칸에 둘을 놓은 곳 (12장 루트 B 흑비·흑박쥐 (7,14), tools/verify.py — 원작 데이터 오류) — 두 판 모두 뒤의 대원을 가장 가까운 빈 칸으로 */
function unstack(ps: Placement[], map: StageMap) {
  const used = new Set<number>()
  for (const p of ps) {
    if (used.has(key(p.x, p.y))) {
      const kind = S.types[p.type].moveKind, seen = new Set([key(p.x, p.y)]), todo = [{ x: p.x, y: p.y }]
      while (todo.length) {
        const c = todo.shift()!
        if (!used.has(key(c.x, c.y)) && moveCost(map, c.x, c.y, kind) < Infinity) { p.x = c.x; p.y = c.y; break }
        for (const [dx, dy] of DIRS) {
          const n = { x: c.x + dx, y: c.y + dy }
          if (inside(map, n.x, n.y) && !seen.has(key(n.x, n.y))) { seen.add(key(n.x, n.y)); todo.push(n) }
        }
      }
    }
    used.add(key(p.x, p.y))
  }
}

// ---------- 한 전투 동안의 기록 ----------

export const leveled = new Set<Unit>()   // 이번 차례에 레벨업 → 차례 끝 피로 0 (원작은 피로를 더한 뒤 레벨업이 0 으로)
export const taken = new Set<number>()   // 이번 전투에서 주운 보물 (S.treasure 칸 번호). 다시 하기는 처음부터
// 대본의 전투 중 시점 (dead·troop·hp) 은 한 전투에 한 번씩 ("시점:값"). 43장: 사바카 1단·최종 모두 사망 조건
export const told = new Set<string>()
export const woke: number[] = []   // 움직이기 시작한(상태 0 으로 바뀐) 부대 — 대본 troop N
export const gained = new Map<Unit, number>()   // 이번 전투에서 얻은 경험치 (일행 대원마다, 개선판 대기 동료 몫 계산)

/** 전투 시작 (다시 하기 포함): 일행·적을 새로 만들어 S.units·S.reserve 에, 기록을 비운다 */
export function freshBattle() {
  uidSeq = 0
  S.joined = []
  leveled.clear()
  taken.clear()
  gained.clear()
  countered.clear()
  counterTurn = undefined
  const all = [...S.allies.map(p => spawn(p, 'ally')), ...S.enemies.map(p => spawn(p, 'enemy'))]
  S.troopState = [...S.troopInit]
  S.units = all.filter(u => S.troopState[u.troop] !== 4)
  S.reserve = all.filter(u => S.troopState[u.troop] === 4)
  S.fired.clear()
  told.clear()
  woke.length = 0
  S.turn = 1
  return all
}

// ---------- 행동 결과 ----------

/** 물리 공격 결과를 대상마다 적용 (피해·혼수 풀림·경계 부대 깨우기). 경험치용 hits */
export function strike(a: Unit, c: Unit) {
  const targets = strikeTargets(a, c)
  const hits: { target: Unit; value: number }[] = []
  for (const t of targets) {
    const dmg = S.ed.rules.rollDamage(S.map, a, t, S.units)   // 협공 (제안 30) 은 맵의 유닛으로
    // 적의 협공 (개선판 어려움) 은 확인창이 없으니 맞은 자리에 「협공」 (일행 쪽은 확인창에 보인다)
    if (a.side === 'enemy' && S.ed.rules.flank?.(a, t, S.units)) S.floats.push({ x: t.x, y: t.y - 0.4, text: '협공', t0: performance.now(), color: '#ff8080' })
    t.hp = Math.max(0, t.hp - dmg)
    t.coma = 0   // 맞으면 혼수가 풀린다 (20ec:9456)
    wake(t)
    t.flash = performance.now() + 160
    S.floats.push({ x: t.x, y: t.y, text: `-${dmg}`, t0: performance.now(), color: t.side === 'ally' ? '#ff8080' : '#ffffff' })
    hits.push({ target: t, value: dmg })
  }
  return { targets, hits }
}

// ---------- 반격 (개선판 B1 제안 3, balance-proposal.md "3 반격") ----------
const countered = new Map<Unit, number>()   // 이번 상대 차례에 되받은 횟수
let counterTurn: Unit['side'] | undefined   // 그 상대 차례의 공격 쪽

/** a 가 from 에 서서 c 를 쳤을 때 c 가 되받는 피해, 0 = 안 되받음 (타격 전에 부른다).
 *  근접 공격 (공격 유형 0·1) 만, 맞고 살아남고 공격자가 자기 사거리 안일 때. 혼수·대기·휴식선 (맞은 뒤 생명 기준) 이면 못 한다 (고정 부대는 제자리에서 싸우니 되받는다 — 못 하면 AI 가 호위 NPC 만 노린다).
 *  피해 = 물리 피해 × scale × decay^(이번 상대 차례에 이미 되받은 횟수), 최소 1. 개선판 = scale 1 · decay 1 (원래 위력, 감쇠 없음) */
export function counterDamage(a: Unit, c: Unit, from: Pos = a): number {
  const cfg = S.ed.counter
  if (!cfg || c.side === a.side || attackKind(a) >= 2 || c.coma > 0 || S.troopState[c.troop] === 2 || !inReach(c, c, from)) return 0
  const dealt = S.ed.rules.damageRange(S.map, a, c, from, S.units)[0], hp = c.hp   // 협공으로 쓰러지면 못 되받는다 (되받는 피해에는 협공 없음)
  if (dealt >= hp) return 0
  c.hp = hp - dealt
  const tired = S.ed.rules.aiRests(c)
  c.hp = hp
  if (tired) return 0
  const ox = a.x, oy = a.y   // 지형 방어는 공격자가 설 칸으로
  a.x = from.x; a.y = from.y
  const full = S.ed.rules.rollDamage(S.map, c, a)
  a.x = ox; a.y = oy
  const n = a.side === counterTurn ? countered.get(c) ?? 0 : 0
  return Math.min(a.hp, Math.max(1, Math.floor(full * cfg.scale * cfg.decay ** n)))
}

/** 되받기를 적용 (counterDamage 값). 반격도 공격처럼 피로가 쌓이고 경험치를 받는다. 레벨이 오르면 결과 */
export function applyCounter(a: Unit, c: Unit, value: number): LevelUp | null {
  if (a.side !== counterTurn) { counterTurn = a.side; countered.clear() }
  countered.set(c, (countered.get(c) ?? 0) + 1)
  a.hp = Math.max(0, a.hp - value)
  a.flash = performance.now() + 160
  S.floats.push({ x: a.x, y: a.y, text: `-${value}`, t0: performance.now(), color: a.side === 'ally' ? '#ff8080' : '#ffffff' })
  const steps = c.steps
  c.steps = 0
  c.fatigue = S.ed.rules.fatigueAfter(c, true)
  c.steps = steps
  const r = addExp(c, [{ target: a, value }])
  leveled.delete(c)   // 레벨업이 이미 피로를 0 으로. 다음 행동까지 끌고 가지 않는다
  return r
}

/** 마법 결과를 범위 안 대상편마다 적용 (판 규칙, 난수 없음). cured = 상태가 풀린 대상 수 */
export function spellResult(a: Unit, m: Magic, c: Pos) {
  const targets = spellTargets(S.ed.rules, a, m, c)
  const foe = S.ed.rules.spellSide(m) === 'foe'
  const hits: { target: Unit; value: number }[] = []
  let cured = 0
  for (const t of targets) {
    const h = S.ed.rules.spell(a, t, m)   // 예측과 같은 값 (난수 없음)
    if (h.kind === 'cure' && ((h.what !== 'coma' && t.poison > 0) || (h.what !== 'poison' && t.coma > 0))) cured++   // 풀린 대상 (20ec:7e3f~7f2f)
    hits.push({ target: t, value: h.kind === 'hp' || h.kind === 'heal' ? h.value : 0 })
    applyHit(t, h)
    if (foe) wake(t)
    if (h.kind === 'hp') t.flash = performance.now() + 160
    S.floats.push({ x: t.x, y: t.y, ...hitText(h, t.side), t0: performance.now() })
  }
  return { targets, hits, cured }
}

/** 전투 밖에서 일행 대원 종류 t 를 levels 만큼 레벨업 (원작 성장식 rules.levelUp 그대로, 장비 승급·마법 습득 포함). 장 사이 상태에 남긴다 */
export function growParty(t: number, levels: number) {
  if (levels <= 0) return
  const u = spawn({ type: t, x: 0, y: 0, troop: 0, member: 0 }, 'ally')
  for (let i = 0; i < levels; i++) { u.type.lv++; S.ed.rules.levelUp(u, S.tables, S.def.route) }
  keepGrowth(u.type)
}

// ---------- 경험치·레벨업 (원작 20ec:9b1d, 0aa2:1afd — 행동 실행 끝, 피로 계산 뒤) ----------

/** 일행(부대 0) 행동자에게 경험치. 100 이상이면 −100, 레벨 +1, 레벨업 결과. 바뀐 값은 장 사이 상태로 (다시 하기는 장 시작 때로 되돌린다) */
export function addExp(a: Unit, hits: { target: Unit; value: number }[], m?: Magic, cured = 0): LevelUp | null {
  if (a.troop !== 0 || a.hp <= 0) return null
  const t = a.type, got = S.ed.rules.expGain(a, hits, m, cured)
  t.exp += got
  gained.set(a, (gained.get(a) ?? 0) + got)
  let r: LevelUp | null = null
  if (t.exp >= 100) {
    t.exp -= 100
    t.lv++
    r = S.ed.rules.levelUp(a, S.tables, S.def.route)
    leveled.add(a)
  }
  keepGrowth(t)
  return r
}

/** 레벨업 창 「승급」 (개선판 B1 제안 36): 전투 중인 일행 대원이 쌓인 장비 승급을 모두 받는다. 능력치·사거리를 장비 차이만큼 고친다 */
export function takePromos(u: Unit) {
  const t = u.type, p = t.promo
  if (!p?.some(Boolean)) return
  const before = equippedStats(t, S.tables.items)
  for (const slot of [0, 1] as const) for (let n = p[slot]; n > 0; n--) {
    const next = nextUpgrade(t, slot, S.tables)
    if (next === undefined) break
    t.equip[slot] = next
  }
  t.promo = undefined
  refit(u, before, S.tables.items)
  u.range = S.ed.rules.weaponRange(t, S.tables.items)
  keepGrowth(t)
}

/** 경계 부대는 공격·마법에 맞으면 깨어난다 (원작 20ec:93b5) */
export function wake(d: Unit) {
  if (S.troopState[d.troop] === 1) { S.troopState[d.troop] = 0; woke.push(d.troop) }
}

/** 휴식 [확정 20ec:038e]: HP 를 판 규칙만큼 (최대HP 까지) 회복 */
export function rest(u: Unit) {
  const heal = Math.min(S.ed.rules.restHeal(u), u.maxHp - u.hp)
  u.hp += heal
  u.fatigue = S.ed.rules.restFatigue(u)
  S.floats.push({ x: u.x, y: u.y, text: heal ? `+${heal}` : '휴식', t0: performance.now(), color: '#7dff9a' })
}

/** 차례를 마칠 때 피로 (공격·이동). 휴식한 차례는 쌓지 않는다 */
export function tire(u: Unit, attacked: boolean, magic?: Magic) {
  u.fatigue = leveled.delete(u) ? 0 : S.ed.rules.fatigueAfter(u, attacked, magic)
  u.steps = 0
  u.power = false
}

/** 방어 태세 (개선판 B1 제안 27, Rules.stance): 움직이지 않고 휴식 대신 차례를 마친다. 피로 −rest (생명 회복 없음),
 *  다음 제 차례 (statusTick) 까지 물리 방어 ×def */
export function brace(u: Unit) {
  const st = S.ed.rules.stance
  if (!st) return
  u.fatigue = Math.max(0, u.fatigue - st.rest)
  u.steps = 0
  u.guard = true
  S.floats.push({ x: u.x, y: u.y, text: '방어', t0: performance.now(), color: '#9ad8ff' })
}

/** 차례를 마친 뒤 두 번째 행동을 받나 (원작 2ff8:1109, 라운드에 한 번). 받으면 이동 기록을 지우고 true */
export function again(u: Unit): boolean {
  if (u.hp <= 0) return false   // 반격에 쓰러짐
  if (u.again || u.hp <= 0 || !S.units.includes(u) || !S.ed.rules.actsTwice(u)) return false
  u.again = true
  u.moved = false
  u.steps = 0
  if (!S.ed.features.commandFirst) S.floats.push({ x: u.x, y: u.y - 0.4, text: '한 번 더', t0: performance.now(), color: '#ffe27a' })
  return true
}

/** 그 칸에서 주울 보물 (원작 20ec:c963: 일행 대원이 행동을 마쳤을 때 선 칸). 주운 것은 소지품 끝에 (원작 +0x1cd3 수, 넘침 검사 없음) */
export function treasureAt(u: Unit) {
  return u.troop === 0 && u.hp > 0 ? [...S.treasure.entries()].filter(([i, t]) => !taken.has(i) && t.at[0] === u.x && t.at[1] === u.y) : []
}
export function takeTreasure(i: number) {
  taken.add(i)
  ITEMS.push(S.treasure[i].item)
  return S.treasure[i].item
}

// ---------- 승패 (원작 2ff8:0def 전투 루프 + 124e:d4a7 장별 조건) ----------

const dead = (r: Member) => { const u = member(r); return !!u && u.hp <= 0 }
// +0x1d56 남은 적 수 — 숨은 부대 대원도 센다
export const enemiesLeft = () => [...S.units, ...S.reserve].filter(u => u.side === 'enemy' && u.hp > 0)

function test(c: CondIf): boolean {
  if ('dead' in c) return c.dead.every(dead)
  const lead = member([0, 0])!
  if ('reach' in c) return lead.x === c.reach[0] && lead.y === c.reach[1]
  if ('hpBelow' in c) { const u = member(c.hpBelow[0]); return !!u && u.hp > 0 && u.hp < u.maxHp * c.hpBelow[1] }
  const left = enemiesLeft()
  return left.length === 1 && left[0] === member(c.onlyLeft)
}

// 부대 상태를 바꾼다. 숨김(4)에서 풀리면 맵에 나온다. 0~3 의미는 editions/original/ai.ts
export function setTroop(t: number, v: number) {
  if (v === 0 && S.troopState[t] !== 0) woke.push(t)
  S.troopState[t] = v
  if (v === 4) return
  for (const u of S.reserve.filter(u => u.troop === t)) {
    S.reserve.splice(S.reserve.indexOf(u), 1)
    S.units.push(u)
  }
}

export type Outcome = 'win' | 'lose' | 'ending'

/** 장별 승패 규칙을 한 번 돌린다 (발동한 규칙은 다시 안 본다). 부대 상태·플래그·합류는 여기서 바꾸고, 재생할 장면은 돌려준다.
 *  fallen = 패배를 부른 대원, deadScenes = 사망 조건 장면 (대본 시점 dead <이름>), scenes = 그 밖 장면, lines = 합류 알림 */
export function judge() {
  const lead = member([0, 0])!
  let result: Outcome | null = lead.hp <= 0 ? 'lose' : null
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
  return { result, fallen, deadScenes, scenes, lines }
}

// ---------- 전투 시작·턴 시작 ----------

/** 전투 시작 처리 (원작 124e:c3da, 전투 전 장면 뒤): 17장 폭탄 (페니 사라짐·일행 HP 70%·매복 출현), 3장 다친 호위, 22장 아티스 자리 비움 */
export function startEvents() {
  for (const d of S.startEv) {
    if ('hpScale' in d) {
      for (const u of S.units) if (u.troop === d.hpScale[0] && u.hp > 0) u.hp = Math.trunc(u.hp * d.hpScale[1])
    } else if ('absent' in d) {
      for (const u of S.units) if (u.troop === 0 && u.type.por === d.absent) { u.hp = 0; u.alpha = 0; u.absent = true }
    } else d.state[0].forEach(t => setTroop(t, d.state[1]))
  }
}

/** 턴 시작 이벤트 (원작 124e:e0a5, 턴 수를 올린 직후): 부대 상태를 바꾸고 재생할 장면을 돌려준다 */
export function turnStart(): string[] {
  const scenes: string[] = []
  for (const e of S.turnEv) {
    if ((e.route ?? S.def.route) !== S.def.route || (e.flag && !FLAGS.has(e.flag))) continue
    if (e.area) {
      const [t, cells] = e.area
      // 일행 대원을 순서대로 본다. 원작은 사망 대원을 만나면 그만두지만 (원작 버그) 살아 있는 대원을 모두 본다
      const party = [...S.units, ...S.reserve].filter(u => u.troop === 0).sort((a, b) => a.member - b.member)
      for (const u of party) {
        if (u.hp <= 0) continue
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
  return scenes
}
