// 전투 진행: 초기화·동작·승패·턴. 규칙·행동 순서·AI 는 판(S.ed)이 정한다
import { MAGIC_EFFECTS, TW, portraitUrl, loadBattles, loadDialogue, loadFig, loadScenes, loadStage, loadTables, loadUnitSprite, type Magic } from './data'
import { rulesWin } from './help'
import { affinityIntro, battleKnown, beginLessons, counterOpened, flushTips, noteTip, openCounter, openFlank, resetTips, seenTip, tipLog, tipNow } from './tips'
import { locked } from './lessons'
import { onOffVolumeWin, soundWin } from './volumeUi'
import { diff, logWin, mark, record, resetLog } from './battleLog'
import { EQUIP, FLAGS, ITEMS, PARTY, finishStage, partyType, promoteDeployed, nextStage, restore, sceneLines, snapshot, takePromo, type Camp } from './campaign'
import type { Edition, LevelUp } from './edition'
import { dist, key, pathTo, reachable, slips, terrainName } from './grid'
import { aimsFrom, attackKind, canAim, strikeArea, strikeCells, strikePlans, strikeTargets } from './attack'
import { campScreen, equipDiff, icon, type CampResult } from './camp'
import { promoteScene } from './promote'
import { clearCut } from './cutscene'
import { SFX, play, preload, soundMs } from './sfx'
import { SONG, playMusic, stageSong, stopMusic } from './music'
import { endingMovie } from './movie'
import { josa } from 'es-hangul'
import { fadeIn, fadeOut } from './fade'
import { busy, imgReady } from './loading'
import { canvas, centerOn, centerOnIfOff, clampCam, frame, resize, toScreen } from './render'
import { layout, mapRect, view } from './screen'
import { loadSkin, pieceUrl, winUrl } from './skin'
import { initBand, setDisabled, setOn, setTerrain, setTitle, setTurn } from './band'
import { initMinimap, minimapOn, removeMinimap, setMinimap } from './minimap'
import { aboveUnit, goGo, hideBasic, levelUpMark, showBasic, showConditions } from './info'
import { playDialogue, resetTalkLog } from './dialogue'
import { loadSlots, loadSuspended, recordClear, recordHidden, recordRun, recordStars, writeSlot, writeSuspended, type Suspended } from './save'
import { stageMarks, starText } from './grade'
import { FOUND, carryOf } from './replay'
import { SKIP_INTRO } from './title'
import { DIFFICULTIES, difficulty, setSetting, setting } from './settings'
import { travelMap } from './worldmap'
import { stageDef, type StageDef } from './stage'
import { alive, canCommand, isNpc, member, S, unitAt } from './state'
import { banter, blocksAt, chapter, epilogue, goalStates, initScript, ownsSteps, recall, resetTalk, story, type When } from './script'
import { back as winBack, modalOpen, closeAll, closeWin, confirmWin, esc, hideMenu, initSkinCss, isOpen, onWinChange, openWin, setOutsideCloses, showMenu, showResult, type Btn } from './ui'
import { applyMods, nextUpgrade, type Pos, type Unit } from './unit'
import { addExp, again, applyCounter, brace, counterDamage, freshBattle, stageTune, judge, placements, rest, spellResult, startEvents, strike, takePromos, takeTreasure, taken, tire, told, treasureAt, turnStart, woke } from './battleCore'
import type { UnitType } from './data'
import { SCHOOL_COLOR, areaCells, hitLine, inSpellRange, spellCenters, spellDesc, spellInfo, spellTargets, spellsOf } from './magic'
import { schoolIcon } from './affIcons'

const STEP_MS = 135   // 한 칸 걷기 (ms)
// 개선판 편의 설정: 적 차례 빠르게 (ai), 전투 연출 짧게. 원작판은 늘 1
let aiTurn = false
const pace = () => !remake() ? 1 : (aiTurn && setting('fastEnemy') ? 0.35 : 1) * (setting('shortAnim') ? 0.5 : 1)

// ---------- 초기화 ----------

let looping = false

let atStart: Camp   // 이 장을 시작할 때 장 사이 상태. 다시 하기는 여기로 되돌린다
let askDeploy = true   // ?stage=N 로 바로 연 판은 출전 선택 없이 앞에서부터
/** 개발·자동 검증 (?nocamp): 일행을 주고도 정비 화면 없이 앞에서부터 출전 */
export const skipDeploy = () => { askDeploy = false }
let carryDeploy: number[] | null = null   // 40장을 건너뛸 때 40장 정비 화면에서 고른 출전을 41장에 그대로 (원작은 정비 화면 한 번)

/** 환의 성전 (40장) 과 네 지도 (원작 124e:a2cf~a449, formats.md 정비 화면): '여행계속' 뒤 다음 장이 40장이면
 *  동·남·서·북의지도 (175~178) 넷이 다 있을 때 「탐험계속?」 (정비 화면이 물음) [결정] = 40장 / [취소] = 건너뜀, 어느 쪽이든 지도 넷을 지운다. 넷이 아니면 묻지 않고 건너뜀.
 *  원작은 B 루트를 0xf44 표 오기로 39장 자리에서 건너뛰지만 웹은 두 판 모두 A·C 규칙 (사용자 결정 2026-10-23) */
const TEMPLE = 40, MAPS = [175, 176, 177, 178]
const allMaps = (items: number[]) => items.filter(i => MAPS.includes(i)).length === 4

/** 장을 불러와 시작한다. 결과 화면에서 다음 장으로 갈 때 다시 불린다.
 *  camp: 장 사이 상태 (null = 캠페인 밖 기본값). 없으면 지금 상태 그대로 (다음 장) */
let song = -1   // 이 장의 전투 곡 (music.ts)

export async function boot(ed: Edition, def: StageDef, camp?: Partial<Camp> | null, resume?: Suspended) {
  await fadeOut()   // 결과 화면·타이틀에서 넘어올 때 (이미 어두우면 바로)
  clearCut()        // 전투 후 컷신의 끝 프레임 (다음 화면까지 남겨 둔다)
  S.ed = ed
  S.def = def
  const extra = ed.extraBattles?.[def.n]   // 개선판 숨은 장: 원작 맵 재사용 + 새 배치·고정 일행
  if (extra) S.def = def = { ...def, title: `숨은 장 · ${extra.title}` }
  song = stageSong(extra?.map ?? def.n)   // 숨은 장은 빌려 쓰는 맵의 장 곡
  const [tables, dialogue, stage, battles, scenes] = await busy(Promise.all([loadTables(), loadDialogue(), loadStage(extra?.map ?? def.n), loadBattles(), loadScenes(), loadSkin()]))
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
  if (resume) {   // 전투 중 저장: 정비 화면·대륙 지도 없이 그 자리부터
    restore(resume.at)
    atStart = snapshot()
    S.deploy = resume.deploy
  } else if (carryDeploy) {
    S.deploy = carryDeploy.filter(i => i < PARTY.length).slice(0, max)
    carryDeploy = null
  } else if (askDeploy) {   // 두 판 모두 전투마다 정비 화면
    const goal = chapter()?.card?.[1]
    const keep = (r: { items: number[]; equip: UnitType['equip'][] }) => {   // 정비 화면에서 고친 소지품·장비
      ITEMS.splice(0, ITEMS.length, ...r.items)
      r.equip.forEach((e, i) => { if (e.join() !== partyType(PARTY[i]).equip.join()) EQUIP.set(PARTY[i], e) })
    }
    let initial = first, r: CampResult
    playMusic(SONG.camp)   // 124e:8994: 정비 화면 곡, 나갈 때 멈춤 (대륙 지도는 무음)
    for (;;) {   // restyle = 현대식 정비 화면 설정에서 화면 모양을 바꿈 → 같은 편성으로 다시
      r = await campScreen({ party: PARTY.map(partyType), items: [...ITEMS], tables, max, remake: !ed.features.originalCamp, initial, modern: ed.id === 'remake' && setting('modernUi'), header: { title: chapterTitle(), goal },
        temple: def.campaign && def.n === TEMPLE && !extra ? allMaps : undefined,
        promote: ed.id === 'remake' ? (i, slot) => takePromo(PARTY[i], slot) : undefined,   // 승급 고르기 (B1 제안 36)
        preview: ed.id === 'remake' ? `${chapterTitle()}${goal ? `\n${goal}` : ''}${envLine()}` : undefined,
        slots: { list: () => loadSlots(ed.id).map(s => s?.title ?? null), save: (i, items, equip) => {
          const base = snapshot(), rec = { ...base.equip }
          equip.forEach((e, k) => { rec[PARTY[k]] = e })
          writeSlot(ed.id, i, { n: def.n, route: def.route, title: chapterTitle(), at: Date.now(), camp: { ...base, items, equip: rec } })
        } } })
      if (r.go !== 'restyle') break
      keep(r)
      initial = r.deploy
    }
    stopMusic()
    if (r.go === 'title') { toTitle(); return }
    if (r.go === 'load') {   // 기록한 칸의 정비 화면부터
      const s = loadSlots(ed.id)[r.slot]
      if (s) { void boot(ed, stageDef(s.n, s.route, true), s.camp); return }
    }
    if (r.go !== 'battle') return
    S.deploy = r.deploy
    keep(r)
    if (def.campaign && def.n === TEMPLE && !extra) {
      const enter = allMaps(ITEMS) && !!r.temple
      if (allMaps(ITEMS)) ITEMS.splice(0, ITEMS.length, ...ITEMS.filter(i => !MAPS.includes(i)))
      const next = nextStage(TEMPLE, def.route)
      if (!enter && next && 'n' in next) { carryDeploy = S.deploy; void boot(ed, stageDef(next.n, next.route, true)); return }
    }
    atStart = snapshot()   // 다시 하기는 정비 화면에서 고친 소지품·장비로
  }
  if (!resume) for (const i of promoteDeployed(S.deploy)) {   // 원작: 정비 화면 뒤 애슬 전직 장면 (도구 미지의책), 그 뒤 대륙 지도
    const t = S.types[PARTY[i]]
    await promoteScene(ed.id === 'remake' ? `${josa(t.name, '이/가')} ${josa(tables.labels.job[t.job], '으로/로')} 전직했다.` : undefined)
    atStart = snapshot()
  }
  if (def.campaign && !resume) await travelMap(def.n)   // 원작: 정비 화면 뒤 대륙 지도에 그 장 장소를 잠깐 (숨은 장은 장소 없음 → 건너뜀)
  Object.assign(S, placements(rec, stage.map))
  S.reward = rec.reward
  S.treasure = rec.treasure ?? []
  S.cond = extra?.cond ?? battles.cond[def.n] ?? []
  S.turnEv = extra?.turn ?? battles.turn[def.n] ?? []
  S.startEv = extra?.start ?? battles.start?.[def.n] ?? []
  S.condText = extra ? undefined : battles.condText?.[def.n]
  S.dialogue = dialogue
  S.map = stage.map
  S.atlas = stage.atlas
  const ids = new Set([...S.allies, ...S.enemies].map(p => p.type))
  for (const id of ids) { const t = S.types[id]; if (t) void imgReady(portraitUrl(t.por)) }   // 대화 초상을 미리 (dialogue.ts 는 안 온 초상을 기다린다)
  await busy(Promise.all([...ids].map(async id => {
    const [img, fig] = await Promise.all([loadUnitSprite(id), loadFig(id)])
    S.sprites.set(id, img)
    if (fig) S.figs.set(id, fig)
  })))
  S.floats = []
  setupScreen(ed, def)
  resize()
  if (!looping) { looping = true; requestAnimationFrame(frame) }
  await start(resume)
}

async function start(resume?: Suspended) {
  await fadeOut()   // 다시 하기 (boot 에서 오면 이미 어둡다)
  clearCut()
  restore(atStart)   // 전투 중 켠 플래그 (27장 black27 등) 를 버린다
  if (resume?.grown) restore({ ...atStart, grown: resume.grown, equip: resume.equip })   // 중단 전에 레벨업한 값으로
  S.ed.beginBattle?.()   // 개선판 난이도 (장 사이 상태를 되돌린 뒤라 다시 하기마다)
  atStart = { ...atStart, flags: snapshot().flags }   // 거기서 켠 판 플래그 (개선판 성장 난수 씨앗 — 다시 하기도 같은 레벨업) 를 장 시작 상태에
  const all = freshBattle()
  resetLog()
  resetTalkLog()
  since = null
  preloadSounds(all)
  playMusic(song, true)   // 2ff8:0a7e: 전투 로드 뒤 장 곡 — 장 앞 대화부터 전투 보상까지 (원작판은 거기서 멈춤, 개선판은 장 뒤 장면까지). 다시 하기는 처음부터
  resetTalk()
  resetTips()
  beginLessons()   // 1장 차례차례 배우기 (core/lessons.ts)
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
  if (S.def.n === 37) await recall('ch37')   // 레스다 회상 (B1 제안 42): 정체를 듣는 장 앞
  await story('pre', S.scenes.pre[S.def.n] ?? [], aliveMember)
  startEvents()
  await banter('start')
  if (!remake()) await goGo()   // 원작: 첫 대화 뒤 「GO!! GO!!」, 첫 클릭에 사라짐
  // 개선판: 장 카드 + 목표 (S2 제안 4, ux-proposal 16) 는 장 앞 대화·1턴 장면을 다 본 뒤, 첫 아군 차례 직전에
  await runRounds(false, remake() ? () => new Promise<void>(ok => showGoalsWin(ok)) : undefined)
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

/** 공격·시전 동작 프레임 (FIG). 8장 = 바라보는 방향의 (준비, 타격), 3장 = 차례로. 그림이 없으면 빈 목록 */
function poseFrames(u: Unit): number[] {
  const n = S.figs.get(u.type.id)?.meta.f.length ?? 0
  if (n === 8) { const d = ['down', 'up', 'left', 'right'].indexOf(u.facing); return [d * 2, d * 2 + 1] }
  return Array.from({ length: n }, (_, i) => i)
}

/** 동작을 마지막 프레임 앞까지 재생하고 마지막 (타격·시전) 프레임에 멈춘다. 그림이 없으면 false */
async function playPose(u: Unit, ms: number) {
  const fr = poseFrames(u)
  if (!fr.length) return false
  for (const f of fr.slice(0, -1)) { u.pose = f; await sleep(ms * pace()) }
  u.pose = fr.at(-1)
  return true
}

/** 이번 전투에서 낼 효과음을 미리 불러 둔다 (원작 124e:18a5: 유닛 초상 번호별 공격음 + 기본 104) */
function preloadSounds(units: Unit[]) {
  preload('e1', [...new Set(units.map(u => u.type.por)), SFX.cannon, SFX.cannon + 1, SFX.cannon + 2, SFX.levelUp, SFX.gotItem, SFX.upgrade, SFX.death])
  preload('e2', new Set(units.flatMap(u => u.type.magic)))
}

/** 투사체 무리 첫 칸 (원작 20ec:dd19, 0x1e2e): 무기 15~19 (화살) → (id − 15)·4, 79~89 (활·포) → (id − 74)·4. 그 밖은 그림 없음 */
function shotBase(weapon: number) {
  return weapon >= 15 && weapon <= 19 ? (weapon - 15) * 4 : weapon >= 79 && weapon <= 89 ? (weapon - 74) * 4 : -1
}

/** 투사체 비행 (원작 20ec:1750 → 24dc~2a68): 직선 경로 칸마다 (공격자 칸부터 중심 칸까지) 4걸음, 걸음마다 1틱, 두 장을 번갈아.
 *  위·아래 = 세로 그림 (0·1 위, 2·3 아래), 왼쪽·오른쪽 = 가로 그림 (0·1 왼쪽, 2·3 오른쪽) (20ec:2008 → 201b~2066).
 *  [근사] 걸음 위치 = 칸 사이를 1/4 씩 (원작 칸 안 오프셋 = 칸 크기/4 × 걸음), 마지막 칸에서 멈춤 */
async function flyShot(a: Unit, c: Unit) {
  const base = shotBase(a.type.equip[0])
  const n = Math.abs(c.x - a.x) + Math.abs(c.y - a.y)
  if (base < 0 || !n) return
  const vert = a.facing === 'up' || a.facing === 'down'
  const back = a.facing === 'down' || a.facing === 'right' ? 2 : 0
  const dx = Math.sign(c.x - a.x), dy = Math.sign(c.y - a.y)
  for (let j = 0; j <= n * 4; j++) {
    S.shot = { name: `shot.${vert ? 'v' : 'h'}.${base + back + (j & 1)}`, x: a.x + dx * j / 4, y: a.y + dy * j / 4 }
    await sleep(TICK * pace())
  }
  S.shot = null
}

/** 포탄 폭발 (원작 20ec:330f): 포 k (0x1e30 = 무기 id − 87, 20ec:e507) 의 MAR 10 프레임 k·4 + 0~3 을 범위 칸 (0x1e3a) 모두에 1틱씩,
 *  둘째 프레임에 폭발음 105 + k (33f2 불러오기 → 3413 재생). 16색 모드면 k = 0 (331d) — 웹은 늘 256색 */
async function explode(k: number, cells: Pos[]) {
  if (k < 0 || k > 2 || !cells.length) return
  for (let i = 0; i < 4; i++) {
    if (i === 1) play('e1', SFX.cannon + k)
    S.boom = { cells, f: k * 4 + i }
    await sleep(TICK * pace())
  }
  S.boom = null
}

/** 화살 명중 (원작 20ec:2a92~330c). 날아온 쪽 = 공격자가 보는 쪽 (20ec:1990: 같은 행 3칸 안 = 왼쪽·오른쪽, 아니면 위·아래).
 *  맞은 유닛이 공격자를 보는 걷기 칸 (아래 1·위 3·왼쪽 5·오른쪽 7) + MAR 6 프레임 2 → 무기 든 자세 (9·10·11·12) 로 날아온 쪽으로 1/4 칸 밀리며 프레임 3, 각 3틱 (게임 +0x1ca2 = 3).
 *  궁수만 이어서 꽂힌 화살 MAR 0 (날아온 방향 아래 0·위 3·왼쪽 6·오른쪽 9 부터 3장) 을 1틱씩. 화살 자리 (bp−0x2f0·2f2) 는 원작 그대로 — 아래로 쏘면 (0, 0) 이라 칸 왼위 (버그 추정) */
const FACE_WALK = { down: 1, up: 3, left: 5, right: 7 }
const FACE_POSE = { down: 9, up: 10, left: 11, right: 12 }
const OPPOSITE = { down: 'up', up: 'down', left: 'right', right: 'left' } as const
async function arrowHit(a: Unit, t: Unit, archer: boolean) {
  const dir = a.facing, face = OPPOSITE[dir]
  const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0, dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0
  t.frame = FACE_WALK[face]
  S.sparks = [{ name: 'mark.2', x: t.x, y: t.y, ox: 0, oy: 0 }]
  await sleep(TICK * 3 * pace())
  t.px = t.x + dx / 4; t.py = t.y + dy / 4
  t.frame = FACE_POSE[face]
  S.sparks = [{ name: 'mark.3', x: t.px, y: t.py, ox: 0, oy: 0 }]
  await sleep(TICK * 3 * pace())
  if (archer) {
    const base = { down: 0, up: 3, left: 6, right: 9 }[dir]
    const [ox, oy] = { down: [0, 0], up: [20, TW / 2 - 5], right: [TW / 2 - 10, 17], left: [TW / 2 - 5, 17] }[dir]
    for (let i = 0; i < 3; i++) {
      S.sparks = [{ name: `arrow.${base + i}`, x: t.px, y: t.py, ox, oy }]
      await sleep(TICK * pace())
    }
  }
  S.sparks = []
  t.frame = undefined
  t.px = t.x; t.py = t.y
}

/** 근접 피격 쪽 (원작 20ec:39c9·1990 과 같은 식): 같은 행 3칸 안이면 왼쪽·오른쪽, 아니면 위·아래 — 맞는 유닛 t 가 공격자 a 를 보는 쪽 */
function faceTo(t: Pos, a: Pos): Unit['facing'] {
  return a.y === t.y && Math.abs(a.x - t.x) <= 3 ? (a.x > t.x ? 'right' : 'left') : a.y > t.y ? 'down' : 'up'
}

/** 근접 공격 앞: 맞을 유닛이 공격자 쪽 걷기 칸으로 돌아선다 (원작 39c9 bp−0x116, 기사 4b7a 도 같음) */
function faceAttacker(a: Unit, targets: Unit[]) {
  for (const t of targets) if (t !== a) t.frame = FACE_WALK[faceTo(t, a)]
}

/** 근접 피격 (원작 단일 근접 20ec:39c9~4b43, 기사 4b7a~5bc0 [확정 2026-11-07]). 공격자가 타격 칸에 닿은 뒤 부른다.
 *  단일: 무기 든 자세 (9~12) + MAR 6 프레임 0 → 공격자 반대쪽으로 1/4 칸 밀리며 프레임 1, 각 3틱.
 *  기사: 맞는 유닛 모두 같은 자세로 두 번 1/4 칸씩 밀림 (54b8~), MAR 6 은 4·5 또는 6·7 (+0x1d58 로 고름, 뜻 미상) — 웹은 4·5 [근사] */
async function meleeHit(a: Unit, targets: Unit[]) {
  const hit = targets.filter(t => t !== a)
  if (!hit.length) return
  const knight = attackKind(a) === 2, mark = knight ? 4 : 0
  const steps = knight ? 2 : 1
  const away = hit.map(t => { const f = faceTo(t, a); return { t, f, dx: f === 'left' ? 1 : f === 'right' ? -1 : 0, dy: f === 'up' ? 1 : f === 'down' ? -1 : 0 } })
  for (const { t, f } of away) t.frame = FACE_POSE[f]
  S.sparks = knight ? [] : away.map(({ t }) => ({ name: `mark.${mark}`, x: t.x, y: t.y, ox: 0, oy: 0 }))
  if (!knight) await sleep(TICK * 3 * pace())
  for (let i = 1; i <= steps; i++) {
    for (const { t, dx, dy } of away) { t.px = t.x + dx * i / 4; t.py = t.y + dy * i / 4 }
    S.sparks = away.map(({ t }) => ({ name: `mark.${mark + 1}`, x: t.px, y: t.py, ox: 0, oy: 0 }))
    await sleep(TICK * 3 * pace())
  }
  S.sparks = []
  for (const { t } of away) { t.frame = undefined; t.px = t.x; t.py = t.y }
}

/** 물리 공격. c = 중심 유닛 (보통 상대, 기사는 같은 편·자신). 맞는 유닛은 공격 유형대로 (core/attack.ts) — 피해식은 대상마다 같은 식 */
async function attack(a: Unit, c: Unit) {
  const targets = strikeTargets(a, c)
  const d = c === a ? targets[0] ?? c : c   // 바라볼 쪽
  if (d !== a) a.facing = d.x > a.x ? 'right' : d.x < a.x ? 'left' : d.y > a.y ? 'down' : 'up'
  const melee = attackKind(a) <= 2
  if (melee) faceAttacker(a, targets)
  // 원작 공격 동작 (FIG 준비 → 타격). 그림이 없으면 상대 쪽으로 살짝 밀고 들어갔다 돌아오기
  // 효과음: 공격자 초상 번호의 소리 (원작 20ec:1897·3ab5·4c67, 타격 프레임 무렵 [근사])
  if (!await playPose(a, 280)) {
    a.px += Math.sign(d.x - a.x) * 0.25; a.py += Math.sign(d.y - a.y) * 0.25
    play('e1', a.type.por)
    await sleep(200 * pace())
    a.px = a.x; a.py = a.y
  } else play('e1', a.type.por)
  // 궁수·추전수·포수: 공격자 칸에서 중심 칸까지 투사체가 날아간다. 포수는 떨어진 범위 칸마다 폭발
  if (attackKind(a) >= 3) await flyShot(a, c)
  const area = strikeArea(a) ? strikeCells(a, c) : []
  if (attackKind(a) === 3) await explode(a.type.equip[0] - 87, area)
  else if (attackKind(a) >= 4 && c !== a) await arrowHit(a, c, attackKind(a) === 4)
  if (area.length) S.fx = { cells: area.map(p => ({ ...p, ring: dist(p, c) })), base: -1, step: 0, color: '255,150,60', t0: performance.now(), until: performance.now() + 420 * pace() }
  const opened = remake() && openCounter(a, c, () => counterDamage(a, c) > 0)   // 1장: 적의 첫 근접 공격에 반격이 열린다 (tips.ts)
  const back = counterDamage(a, c)   // 타격 전 상태로 판단 (맞으면 혼수가 풀린다)
  if (remake()) attackTips(a, targets)
  const { hits } = strike(a, c)
  if (melee) await meleeHit(a, targets)   // 맞는 자세·밀림 (원작 39c9·4b7a) 이 타격 프레임을 보이는 동안
  else await sleep(320 * pace())   // 타격 프레임을 잠시 보인다
  a.pose = undefined
  await sleep(220 * pace())
  S.fx = null
  await fadeDead(targets)
  await gainExp(a, hits)
  if (back) { await counterAct(a, c, back); if (opened) await counterOpened(); else if (remake()) noteTip('counter') }
}

/** 시스템 대화 안내 (tips.ts): 일행의 협공 (상성은 장 시작에 소개한다 — affinityIntro) */
function attackTips(a: Unit, targets: Unit[]) {
  if (a.troop === 0 && targets.some(t => t.side !== a.side && (S.ed.rules.flank?.(a, t, S.units) ?? 0) > 0)) noteTip('flank')
}

/** 반격 연출 (개선판 제안 3): 맞은 쪽이 공격 동작으로 되받는다 */
async function counterAct(a: Unit, c: Unit, value: number) {
  c.facing = a.x > c.x ? 'right' : a.x < c.x ? 'left' : a.y > c.y ? 'down' : 'up'
  S.floats.push({ x: c.x, y: c.y, text: '반격', t0: performance.now(), color: '#ffd24a' })
  faceAttacker(c, [a])
  if (!await playPose(c, 280)) {
    c.px += Math.sign(a.x - c.x) * 0.25; c.py += Math.sign(a.y - c.y) * 0.25
    play('e1', c.type.por)
    await sleep(200 * pace())
    c.px = c.x; c.py = c.y
  } else play('e1', c.type.por)
  const r = applyCounter(a, c, value)
  await meleeHit(c, [a])
  c.pose = undefined
  await sleep(220 * pace())
  await fadeDead([a])
  if (r) await showLevelUp(c, r)
}

// ---------- 경험치·레벨업 (원작 20ec:9b1d, 0aa2:1afd — 행동 실행 끝, 피로 계산 뒤) ----------

/** 일행(부대 0) 행동자에게 경험치, 레벨이 오르면 연출 */
async function gainExp(a: Unit, hits: { target: Unit; value: number }[], m?: Magic, cured = 0) {
  const r = addExp(a, hits, m, cured)
  if (r) await showLevelUp(a, r)
}

/** 레벨업 창의 받을 수 있는 승급 한 칸: 쌓인 단계를 모두 받았을 때의 장비와 능력치 차 */
function offerFig(t: UnitType, slot: 0 | 1) {
  const n = t.promo?.[slot] ?? 0, to = n ? nextUpgrade(t, slot, S.tables, n - 1) : undefined
  if (to === undefined) return []
  return [`<figure class="offer">${icon(to)}<figcaption>${slot ? '방어구' : '무기'} 승급${n > 1 ? ` ×${n}` : ''}<br><span class="blue">${esc(S.tables.items.get(to)?.name ?? '')}</span><br><small>${equipDiff(t, slot, to, S.tables.items) || '능력치 그대로'}</small></figcaption></figure>`]
}

/** 레벨업 연출: 머리 위 「Level Up」. 원작판은 승급·습득만 알림 (원작 0aa2:12f2), 개선판은 오른 능력치까지 */
async function showLevelUp(u: Unit, r: LevelUp) {
  const { sx, sy } = toScreen(u.x, u.y)
  play('e1', SFX.levelUp)   // 원작 20ec:9eb6
  await levelUpMark(sx, sy, TICK * 2 * pace())
  const STAT = ['생명', '역량', '방어', '정신', '민첩']
  const lines = remake() ? [`${esc(u.type.name)} <span class="blue">Lv ${u.type.lv}</span>`, r.gains.map((g, i) => g ? `${STAT[i]} +${g}` : '').filter(Boolean).join(' ') || '능력치 그대로'] : []
  // 새로 얻은 것: 장비 = 정비 화면과 같은 EQU 그림, 마법 = 마법 아이콘 (MAR)
  const item = (label: string, id?: number) => id === undefined ? [] : [`<figure>${icon(id)}<figcaption>${label}<br><span class="blue">${esc(S.tables.items.get(id)?.name ?? '')}</span></figcaption></figure>`]
  const offers = ([0, 1] as const).filter(s => r.offer?.[s]).flatMap(s => offerFig(u.type, s))   // 개선판 승급 고르기 (B1 제안 36)
  const got = [...item('무기 승급', r.weapon), ...item('방어구 승급', r.armor), ...offers,
    ...r.magic === undefined ? [] : [`<figure><i class="mg" style="background-position:-${r.magic * 32}px 0"></i><figcaption>마법 습득<br><span class="blue">${esc(S.tables.magic.get(r.magic)?.name ?? '')}</span></figcaption></figure>`]]
  if (!lines.length && !got.length) return
  const body = lines.join('<br>') + (got.length ? `<div class="lvup">${got.join('')}</div>` : '')
  if (offers.length) await tipNow('promo', undefined, undefined, true)   // 승급 고르기 안내 (tips.ts): 처음 제안 때 레벨업 창 앞에 (고르기 전에), 셈 밖
  if (got.length) play('e1', SFX.upgrade)   // 원작 알림 창 0aa2:12f2 모드 1~3 (승급·습득) = 110
  await new Promise<void>(ok => openWin({ title: '레벨 업', body, bodyH: lines.length * 16 + (got.length ? 96 : 0) + (offers.length ? 16 : 0) + 8, at: 'center', kind: 'levelup', dir: 'row',
    width: Math.max(180, got.length * 112 + 24, ...lines.map(l => l.replace(/<[^>]+>/g, '').length * 14 + 32)),
    buttons: offers.length ? [['승급', () => { takePromos(u); ok() }], ['나중에', ok]] : [['확인', ok]], onBack: () => { closeWin('levelup'); ok() }, x: false }))
  if (u.type.id === PARTY[0]) await recall(u.type.lv >= 20 ? 'lv20' : u.type.lv >= 10 ? 'lv10' : null)   // 레스다 회상 (B1 제안 42)
}

/** 원작 타이머 한 틱 (BIOS 18.2Hz, 0aa2:02f0 기다리기 단위) */
const TICK = 1000 / 18.2

/** 사망 연출 (원작 20ec:09d8, 적 감소 20ec:9aa5 앞·중독 20ec:b155 에서 회전 3 으로 부름):
 *  ① 걷기 그림 MOV 프레임 1·3·5·7 (아래·위·왼쪽·오른쪽) 을 3 바퀴 — 기다림 없이 그리기 속도대로라 웹은 한 장 한 틱 [근사]
 *  ② 유닛을 지우고 그 칸에 ECLIPSE.MAR 5 구멍 6장, 한 장 2틱. 둘째 장에서 사망음 111 ③ 5틱 쉼 */
async function fadeDead(units: Unit[]) {
  const dying = units.filter(u => u.hp <= 0 && u.alpha > 0)
  if (!dying.length) return
  for (let i = 0; i < 12; i++) { for (const d of dying) d.frame = 1 + 2 * (i % 4); await sleep(TICK * pace()) }
  for (const d of dying) { d.alpha = 0; d.frame = undefined }
  const holes = dying.map(d => ({ x: d.x, y: d.y, f: 0 }))
  S.holes.push(...holes)
  for (let f = 0; f < 6; f++) {
    for (const h of holes) h.f = f
    if (f === 1) play('e1', SFX.death)
    await sleep(TICK * 2 * pace())
  }
  S.holes = S.holes.filter(h => !holes.includes(h))
  await sleep(TICK * 5 * pace())
}

/** 마법 (행동 실행 20ec:6e92 마법 분기): 범위 안 대상편마다 판 규칙의 결과. c = 중심 칸.
 *  연출 = 원작 ECLIPSE.MAG 이펙트 (20ec:5c0f): 프레임 id×6 ~ +5 를 박자마다, 범위 반경 r 만큼 바깥 칸이 늦게 (박자 6 + 범위). 결과는 이펙트가 끝난 뒤 */
async function castSpell(a: Unit, m: Magic, c: Pos) {
  if (c.x !== a.x || c.y !== a.y) a.facing = c.x > a.x ? 'right' : c.x < a.x ? 'left' : c.y > a.y ? 'down' : 'up'
  a.flash = performance.now() + 200
  // 원작 시전 동작 (FIG: 마법 쓰는 인물은 3장 — 오브·마법진이 커진다). 마지막 프레임을 이펙트 동안 유지
  // 효과음: 시전자 초상 번호 소리 → 이펙트 때 마법 소리 ECLIPSE2.FVT[마법 id] (원작 20ec:5d5c → 6348, 6924 → 69eb [근사 시점])
  // 소리는 한 번에 하나라 (sfx.ts) 시전음이 끝난 뒤 마법 소리를, 이펙트 박자는 마법 소리 길이에 맞춰 늘린다 [웹: 원작 MAG 박자 미대조]
  // 시전음은 동작과 함께 시작한다 [웹: 원작은 동작을 다 그린 뒤 재생 — 그동안 무음이 길어 두 판 모두 앞당김 (2026-10-16)]
  play('e1', a.type.por)
  const began = performance.now()
  const [posed, voice, sound] = await Promise.all([playPose(a, 240), soundMs('e1', a.type.por), soundMs('e2', m.id)])
  await sleep(Math.max((posed ? 200 : 300) * pace(), voice * pace() - (performance.now() - began)))
  const cells = areaCells(m, c).map(p => ({ ...p, ring: dist(p, c) })), beats = 6 + Math.max(0, ...cells.map(p => p.ring))
  const step = Math.max(90, sound / beats) * pace(), t0 = performance.now(), span = beats * step
  play('e2', m.id)
  S.fx = { cells, base: m.id * 6, step, color: SCHOOL_COLOR[m.school] ?? SCHOOL_COLOR[8], t0, until: t0 + span }
  await sleep(span - step)   // 마지막 박자와 겹쳐 결과를 띄운다
  const { targets, hits, cured } = spellResult(a, m, c)
  await sleep(step)
  S.fx = null
  a.pose = undefined
  await sleep(300 * pace())
  await fadeDead(targets)
  await gainExp(a, hits, m, cured)
}

// ---------- 숨은 보물 (원작 20ec:c963: 일행 대원이 행동을 마쳤을 때 선 칸, 이동만 하고 취소하면 줍지 않는다) ----------

/** 그 칸의 보물을 줍는다: 알림 창 (원작 0aa2:12f2 모드 0) 뒤 소지품 끝에 */
async function pickUp(u: Unit) {
  for (const [i] of treasureAt(u)) await gotItem('보 물', takeTreasure(i), u.type.name)
}

/** 도구를 얻은 알림 창 (원작 0aa2:12f2 모드 0 보물 줍기·모드 5 전투 보상: ECPLEV "level" 창 + EQU 아이콘 + 파란 이름, 효과음 ECLIPSE1 109).
 *  원작 창은 제목 글자가 빈 문자열 (DS:0xa9e) — 제목·주운 대원 이름은 웹 보탬. 자리 = 가운데 [근사] */
function gotItem(title: string, item: number, who?: string) {
  play('e1', SFX.gotItem)
  const name = esc(S.tables.items.get(item)?.name ?? '')
  return new Promise<void>(ok => openWin({ title, body: `<div class="lvup"><figure>${icon(item)}<figcaption>${who ? `${esc(who)}<br>` : ''}<span class="blue">${name}</span></figcaption></figure></div>`,
    bodyH: 104, at: 'center', kind: 'levelup', dir: 'row', width: 180, buttons: [['확인', ok]], onBack: () => { closeWin('levelup'); ok() }, x: false }))
}

/** 유닛 차례 끝. 개선판은 이동·공격 없이 마치면 휴식, guard = 방어 태세 (제안 27, 휴식 대신) */
function finishUnit(u: Unit, attacked = false, magic?: Magic, guard = false) {
  if (guard) brace(u)
  else if (S.ed.features.autoRest && !attacked && !magic && !u.moved) rest(u)
  else tire(u, attacked, magic)
  const twice = again(u)
  if (!twice) u.acted = true
  S.mode = { kind: 'idle' }
  hideMenu()
  hideBasic()
  S.aim = null
  const found = u.hp > 0 && treasureAt(u).length > 0
  if (found) S.mode = { kind: 'busy' }
  void (found ? pickUp(u).then(() => { S.mode = { kind: 'idle' } }) : Promise.resolve()).then(checkEnd).then(async over => {
    if (!over && remake()) await flushTips()   // 이 행동에서 생긴 안내 (반격·협공·상성, tips.ts)
    if (over) stepDone?.(true)
    else if (S.active.every(a => a.acted || a.hp <= 0)) stepDone?.(false)
    else if (twice && remake() && S.mode.kind === 'idle') select(u)   // 개선판: 두 번째 행동할 대원을 골라 둔다
  })
}

// ---------- 승패 (원작 2ff8:0def 전투 루프 + 124e:d4a7 장별 조건) ----------

export async function checkEnd(): Promise<boolean> {
  const { result, fallen, deadScenes, scenes, lines } = judge()
  if (result === 'lose') {
    S.mode = { kind: 'busy' }
    closeAll()
    hideBasic()
    if (remake()) showResult('패 배', `${josa(fallen.type.name, '이/가')} 쓰러졌다.`, [['다시 하기', () => void start()], ['정비 화면', toCamp], ['타이틀로', toTitle]])
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
  // 레스다 회상 (B1 제안 42): 선두 생명이 처음 30% 아래로
  const lead = S.units.find(u => u.troop === 0 && u.type.id === PARTY[0])
  if (!result && lead && lead.hp > 0 && lead.hp < lead.maxHp * 0.3) { S.mode = { kind: 'busy' }; await recall('hp'); S.mode = prev }
  if (!result) return false
  // 원작 2ff8:1706: 전투 함수가 끝나면 (결과 3 이 아니면) 보상 품목 (BAD w121~) 마다 알림 창 (모드 5) → 소지품 끝에. 웹은 finishStage 가 넣는다
  for (const item of S.reward) await gotItem('보 상', item)
  // 원작 2ff8:1909: 보상 뒤 장 곡을 멈추고 풀어, 장 뒤 장면·컷신은 음악 없이 (컷신 효과음만). 개선판은 장 곡을 이어 간다
  if (!remake()) stopMusic()
  const bench: { text: string }[] = []
  S.ed.afterWin?.(bench, atStart)   // 개선판: 대기 동료 경험치·쓰러진 대가
  const benched = bench.length > 0 && PARTY.some(t => !S.units.some(u => u.troop === 0 && u.type.id === t))   // 대기 동료 안내 (tips.ts): 이 장 뒤 합류하는 동료는 빼고 (growth.ts benchShare 와 같은 때)
  const done = finishStage(S.joined, S.reward, aliveMember, ownsSteps(chapter()))
  await story('post', done.scenes, aliveMember, undefined, [...done.notes, ...bench])
  if (remake() && result !== 'ending') await postTips(benched)
  if (result === 'ending' && !S.ed.extraBattles?.[S.def.n]) {
    // 원작 엔딩 영상 (0aa2:3982): 마지막 전투 일행 (쓰러진 대원 포함) 에 채스 (초상 6) +1, 소피아 (초상 28) +2, 루트별 장면. 엔딩 곡은 영상이 튼다
    const party = S.units.filter(u => u.side === 'ally' && u.troop === 0).map(u => u.type.por)
    await fadeOut()
    await endingMovie(S.def.route, (party.includes(6) ? 1 : 0) + (party.includes(28) ? 2 : 0))
    await fadeIn()
    await epilogue(aliveMember)   // 개선판 후일담 (원작판은 대본이 없어 바로 끝)
  } else {
    if (result === 'ending') playMusic(SONG.ending)   // 숨은 장의 엔딩(진엔딩)은 그 장 대본이 맡는다
    await banter('win')   // 전투 후 장면 뒤 (보스의 마지막 말 다음). 마지막 전투는 에필로그만
  }
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
function showGoalsWin(onClose?: () => void, button?: string) {
  const card = chapter()?.card
  showConditions({ title: remake() ? (card ? `${S.def.n}장 · ${card[0]}` : S.def.title) : '', goal: remake() ? card?.[1] : undefined, env: remake() ? stageTune()?.env : undefined,
    goals: remake() ? goalStates(aliveMember) : undefined, marks: remake() ? stageMarks() : undefined, orig: !remake(), onClose, button })
}

/** 타이틀로: 페이지를 새로 불러 전투 상태를 깨끗이 버린다 (판은 save 의 마지막 판으로 기억). 로고 연출은 이번만 건너뛴다 */
export const toTitle = () => {
  stopMusic()
  try { sessionStorage.setItem(SKIP_INTRO, '1') } catch { /* 무시 */ }
  void fadeOut().then(() => { location.href = location.pathname })
}

function cleared(ending: boolean) {
  const def = S.def, next = ending ? null : nextStage(def.n, def.route)
  const sus = loadSuspended(S.ed.id)
  if (sus && sus.def.n === def.n && sus.def.route === def.route) writeSuspended(S.ed.id, null)   // 이긴 전투의 중간 저장은 지난 것
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
  const fallen = S.units.filter(u => u.troop === 0 && u.hp <= 0 && !u.absent).map(u => u.type.name)
  const goals = goalStates(aliveMember)
  const marks = stageMarks(true), got = marks.filter(m => m.state === 'done').length   // 장 평가 (제안 11·34)
  if (marks.length) recordStars(S.ed.id, def.n, def.route, got, marks.length)
  const lines = [...marks.length ? [`도전 과제 ${starText(got, marks.length)}`, ...marks.map(m => `${m.state === 'done' ? '✓' : '✗'} ${m.text}`), ''] : [],
    `${S.turn}턴 · 난이도 ${DIFFICULTIES[difficulty()]}`, fallen.length ? `쓰러진 동료 ${fallen.join(', ')}` : '쓰러진 동료 없음',
    ...goals.length ? [`보조 목표 ${goals.filter(g => g.state === 'done').length} / ${goals.length}`] : []]
  const buttons: Btn[] = []
  if (onward) buttons.push(['다음 장', onward])
  buttons.push(['다시 하기', () => void start()], ['타이틀로', toTitle])
  showResult(ending ? '엔 딩' : '승 리', lines.join('\n'), buttons)
}

/** 진로선택 (원작 0aa2:0b0d [확정]: 화면 (280,220) 에 125×122 "comma" 창 「진로선택」 (DS:0x233d), 글자 버튼 암흑동굴·혼탁한호수·옛 신전 순 → 루트 B·A·C,
 *  왼쪽 클릭만 받고 취소 없음). 개선판은 고른 길의 목적을 확인창에 보이고 결정·취소로 확인 */
export function chooseRoute(): Promise<number> {
  const order = S.ed.routeOrder ?? [0, 1, 2]
  const places = S.ed.routePlaces ?? S.ed.routeLabels
  return new Promise(ok => {
    const open = () => {
      openWin({ title: '진로선택', kind: 'route', at: remake() ? 'center' : { x: 280, y: 220 }, btnW: remake() ? 112 : 101,
        width: remake() ? Math.min(view.w - 160, 300) : 125,
        buttons: order.map((r): Btn => [places[r], () => remake() ? confirmWin('진로선택', 'center', () => ok(r), open, esc(S.ed.routeLabels[r]), 260) : ok(r)]) })
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

/** 턴 시작 이벤트 (원작 124e:e0a5, 턴 수를 올린 직후) 와 그 장면 */
async function turnEvents() {
  const scenes = turnStart()
  await story('turn', scenes, aliveMember, String(S.turn))
  for (const [w, a] of scriptMoments()) await story(w, [], aliveMember, a)
}

/** 라운드 반복. 판의 order() 가 준 행동 단계를 차례로 실행한다 (원작판 = 한 명씩, 개선판 = 페이즈제). 전투가 끝나면 돌아온다.
 *  intro = 첫 턴 장면 뒤, 첫 행동 단계 전에 한 번 (개선판 조건 창)
 *  원작: 턴·차례 알림 없음 (띠는 장 제목만). 개선판: 띠의 턴 패 + 아군 차례 시작마다 「GO!! GO!!」 */
async function runRounds(resumed = false, intro?: () => Promise<void>) {
  for (;;) {
    if (!resumed) {
      for (const u of [...S.units, ...S.reserve]) { u.acted = false; u.moved = false; u.steps = 0; u.ticked = false; u.again = false }
      S.mode = { kind: 'busy' }
      await turnEvents()
      await intro?.()
      intro = undefined
    }
    resumed = false
    for (const step of S.ed.order([...S.units, ...S.reserve], S.turn)) {
      const live = step.filter(u => u.hp > 0 && S.units.includes(u))
      if (!live.length) continue
      const lead = live[0], party = lead.troop === 0
      const side = party ? 'ally' : isNpc(lead) ? 'npc' : 'enemy'
      if (party && live.every(u => u.acted)) continue   // 중단 저장에서 이어 온 턴: 이미 마친 단계
      updatePhase(side, step.length > 1 ? '' : lead.type.name)
      if (party) {   // 차례 시작 처리 (중독·혼수·강화 되돌림). 혼수 대원은 휴식하고 넘긴다
        if (remake()) enemySummary()
        const before = mark()
        let skipped = false
        for (const u of live) if (await tickUnit(u) === 'over') return
        if (live.every(u => u.acted || u.hp <= 0)) skipped = true
        else {
          if (step.length > 1) await goGo(900)
          if (remake()) { turnTips(live); await flushTips(false, true) }   // 차례 시작 묶음 + 적 차례에 생긴 안내 (tips.ts)
          if (await playerStep(live)) return
        }
        if (remake()) { record(S.turn, 'ally', diff(before, 'ally')); since = { at: mark(), turn: S.turn } }
        if (skipped) continue
      } else if (await aiStep(step)) return
    }
    S.turn++
  }
}

/** 개선판 적 차례 요약 (B1 N6): 아군 차례가 끝난 뒤부터 (동료·적 차례, 다음 턴 시작 장면) 바뀐 것을 전투 기록에 */
let since: { at: ReturnType<typeof mark>; turn: number } | null = null
function enemySummary() {
  if (!since) return
  record(since.turn, 'enemy', diff(since.at, 'enemy'))
  since = null
}

/** 아군 차례 시작에 깔 안내 (tips.ts). 한 묶음으로 tips.ts BUNDLE 순서 (호위 → 경계 → 상성 → 고대 병기 → 전력·방어 → 피로) 로 보인다 */
function turnTips(live: Unit[]) {
  const foes = alive('enemy')
  openFlank()   // 1장: 반격을 배운 다음 차례에 협공을 열고 소개
  if (S.cond.some(r => r.do.includes('lose') && 'dead' in r.if && r.if.dead.some(d => { const u = member(d); return !!u && isNpc(u) }))) noteTip('escort')
  if (foes.some(f => S.troopState[f.troop] === 1)) noteTip('wake')
  affinityIntro(live, foes)   // 처음 보이는 상성 갈래 (불사족·비행·마법 쓰는 적·중갑·적 궁수·종족)
  if (live.some(u => foes.some(f => S.ed.rules.bane?.(u, f)))) noteTip('ancient')
  if (S.def.n >= 2 && S.ed.rules.stance) noteTip('stance')
  if (live.some(u => u.fatigue > 70)) noteTip('tired')
}

/** 이긴 장 뒤 (원작 장면 뒤): 쓰러진 대가·대기 동료 경험치 안내. 전투 중 남은 안내는 버리고 이 둘만 (셈 없이) */
async function postTips(benched: boolean) {
  resetTips()
  const down = S.units.filter(u => u.troop === 0 && u.hp <= 0 && !u.absent && FLAGS.has(`down:${u.type.name}`))   // growth.ts fallenCost 가 세운 플래그
  if (down.length) await tipNow('down', undefined, down.map(u => u.type.name).join(', '), true)
  if (benched) await tipNow('bench', undefined, undefined, true)
}

// 플레이어 단계: 단계의 일행 대원이 모두 행동하거나 턴 종료(원작판은 휴식)를 누를 때까지
let stepDone: ((over: boolean) => void) | null = null
function playerStep(units: Unit[]): Promise<boolean> {
  return new Promise(ok => {
    S.active = units
    stepDone = over => { stepDone = null; S.active = []; updatePhase(); ok(over) }
    S.mode = { kind: 'idle' }
    // 원작판은 유닛을 눌러 명령부터 고른다. 개선판은 차례가 오면 움직일 대원을 골라 둔다
    const first = units.length === 1 ? units[0] : remake() ? firstToMove(units) : null   // 혼수로 넘긴 대원은 runRounds 가 미리 거른다
    if (first) {
      centerOnIfOff(first)
      if (remake()) select(first)
    }
    updatePhase()
  })
}

/** 개선판 아군 차례 시작에 골라 둘 대원: 이번 차례에 적을 칠 수 있는 대원 → 움직일 수 있는 대원 → 아무나, 같으면 출전 순서 */
function firstToMove(units: Unit[]): Unit | null {
  const live = units.filter(u => u.hp > 0 && !u.acted).sort((a, b) => a.member - b.member)
  const foes = alive('enemy')
  const score = (u: Unit) => {
    const moves = reachable(S.map, S.units, u)
    if (foes.length && strikePlans(u, moves).length) return 2
    return moves.size > 1 ? 1 : 0
  }
  return live.map(u => ({ u, s: score(u) })).sort((a, b) => b.s - a.s)[0]?.u ?? null
}

/** 메뉴의 턴 종료는 한 번 묻는다 (개선판 띠·시스템 창). E 키는 바로 */
function confirmEnd() {
  if (S.mode.kind === 'busy' || !stepDone) return
  const left = S.active.filter(u => !u.acted && u.hp > 0).length
  confirmWin('턴 종료', 'center', endPlayerStep, () => {}, left ? `행동하지 않은 대원 ${left}명` : undefined, left ? 230 : undefined)
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
    const st = await tickUnit(u)
    if (st === 'over') return true
    if (st === 'skip') continue
    do { if (await aiAct(u, units.length === 1)) return true } while (again(u))
  }
  return false
}
/** 컴퓨터 유닛 행동 하나. 전투가 끝나면 true */
async function aiAct(u: Unit, alone: boolean): Promise<boolean> {
  const plan = S.ed.planFor(S.map, S.units, u, S.troopState)
  if (plan.rest) {   // 개선판은 물러난 뒤 쉬기도 한다 (B1 제안 10)
    const back = pathTo(reachable(S.map, S.units, u), plan.dest.x, plan.dest.y)
    if (back.length > 1) { if (alone) updatePhase(phase.side, u.type.name); centerOnIfOff(u); await walk(u, back) }
    rest(u)
    if (u.side === 'enemy' && remake()) noteTip('foeRest')   // 다음 아군 차례에 안내 (tips.ts)
    return false
  }
  const path = pathTo(reachable(S.map, S.units, u), plan.dest.x, plan.dest.y)
  const acts = path.length > 1 || (plan.target && plan.target.hp > 0) || !!plan.magic
  if (acts && alone) updatePhase(phase.side, u.type.name)
  if (path.length > 1) { centerOnIfOff(u); await walk(u, path) }
  if (plan.magic && plan.at) {
    centerOnIfOff(plan.at)
    await castSpell(u, plan.magic, plan.at)
    tire(u, false, plan.magic)
    return checkEnd()
  }
  const hits = !!plan.target && plan.target.hp > 0
  if (hits) { centerOnIfOff(u); await attack(u, plan.target!) }
  tire(u, hits)
  return checkEnd()
}

/** 차례 시작 (20ec:a419): 판 규칙의 상태 이상 처리. 'over' = 중독으로 전투가 끝남, 'skip' = 혼수·사망으로 이번 차례 없음 */
async function tickUnit(u: Unit): Promise<'ok' | 'skip' | 'over'> {
  if (u.ticked) return u.acted ? 'skip' : 'ok'
  u.ticked = true
  const r = S.ed.rules.statusTick(u)
  if (r.poison) {
    centerOnIfOff(u)
    u.flash = performance.now() + 160
    S.floats.push({ x: u.x, y: u.y, text: `-${r.poison}`, t0: performance.now(), color: '#d48cff' })
    await sleep(350 * pace())
    await fadeDead([u])
    if (await checkEnd()) return 'over'
  }
  if (u.hp <= 0) return 'skip'
  if (r.coma) {
    rest(u)
    S.floats.push({ x: u.x, y: u.y - 0.4, text: '혼수', t0: performance.now(), color: '#9ad8ff' })
    u.acted = true
    if (!aiTurn) await sleep(300 * pace())
    return 'skip'
  }
  return 'ok'
}

// ---------- 화면 (띠·미니맵) ----------

/** 장 이름: 개선판은 장 카드 장소 ("3장 · 지하 신전") */
function chapterTitle() {
  const card = chapter()?.card
  return S.ed.id === 'remake' && card && !S.ed.extraBattles?.[S.def.n] ? `${S.def.n}장 · ${card[0]}` : S.def.title
}

const remake = () => !S.ed.features.commandFirst

// 개선판 메뉴와 거기서 여는 창 (「이전」 으로 메뉴에 돌아간다). 떠 있는 동안 띠 「메뉴」 를 눌린 모양으로 (다시 누르면 모두 닫힌다)
const MENU_WINS = ['system', 'screen', 'sound', 'rules', 'log']
const menuOpen = () => MENU_WINS.some(isOpen)
onWinChange(() => setOn('menu', menuOpen()))
setOutsideCloses(() => S.map !== null && remake())   // 개선판 전투: 창 바깥 = 뒤로 (input.ts) → 창에 ✕ 없음

/** 장마다: 논리 화면 크기 (개선판 = 창에 맞춰 넓게), 띠 버튼, 미니맵 */
function setupScreen(ed: Edition, def: StageDef) {
  applyScreenStyle(ed.id === 'remake')
  S.marks = true
  S.threat = false
  initBand(ed.id === 'remake', [
    { id: 'goal', label: '목표', side: 'left', prio: 2, on: () => showGoalsWin() },
    { id: 'end', label: '턴 종료', side: 'right', prio: 0, on: confirmEnd },
    { id: 'menu', label: '메뉴', side: 'right', prio: 0, on: () => menuOpen() ? MENU_WINS.forEach(k => closeWin(k)) : systemMenu() },
    { id: 'threat', label: '위험', side: 'right', prio: 1, on: toggleThreat },
    { id: 'map', label: '지도', side: 'right', prio: 3, on: toggleMinimap },
  ])
  if (ed.id === 'remake') { initMinimap(); setOn('map', minimapOn()) } else removeMinimap()
}

/** 화면 틀: 원작판 = 640×480 원작 창틀, 개선판 = 넓게 + 설정에 따라 원작 창틀 / 현대식 (ux-proposal.md 32) */
function applyScreenStyle(wide = S.ed.id === 'remake') {
  layout(wide, wide && setting('modernUi'))
  canvas.style.cursor = view.modern ? 'default' : `url(${pieceUrl('sta.0')}) 2 2, default`   // 원작 커서 = 날개 지팡이 (STA 0)
}

/** 전투 중 화면 틀 바꾸기 (개선판 메뉴) */
function toggleScreenStyle() {
  const m = mapRect(), cx = S.cam.x + m.w / 2 / S.cam.scale, cy = S.cam.y + m.h / 2 / S.cam.scale   // 보던 가운데를 그대로
  setSetting('modernUi', !setting('modernUi'))
  applyScreenStyle()
  resize()
  const n = mapRect()
  S.cam.x = cx - n.w / 2 / S.cam.scale
  S.cam.y = cy - n.h / 2 / S.cam.scale
  clampCam()
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

/** 중간 저장 (개선판 메뉴, 2026-11-06 「중단」 에서 바꿈): 아군 차례 중 지금 상태를 저장하고 전투는 그대로. 한 칸 (판마다) 을 덮어쓴다.
 *  타이틀 「지난흔적」 → 「전투 중 저장」 에서 그 턴 아군 차례부터. 이 장을 이기면 지운다 */
function midSave(back: () => void) {
  if (!stepDone || S.mode.kind === 'busy') return
  cancel()
  const all = [...S.units, ...S.reserve].sort((a, b) => a.uid - b.uid)
  writeSuspended(S.ed.id, {
    def: S.def, title: chapterTitle(), at: atStart, deploy: S.deploy, turn: S.turn,
    units: all.map(u => ({ x: u.x, y: u.y, hp: u.hp, fatigue: u.fatigue, acted: u.acted, moved: u.moved, steps: u.steps, facing: u.facing, alpha: u.alpha, onMap: S.units.includes(u),
      mods: { ...u.mods }, poison: u.poison, coma: u.coma, ticked: u.ticked, again: u.again })),
    troopState: S.troopState, fired: [...S.fired], told: [...told], joined: S.joined, flags: [...FLAGS], saved: Date.now(),
    grown: snapshot().grown, equip: snapshot().equip, items: [...ITEMS], taken: [...taken],
  })
  showResult('중간 저장', `${S.turn}턴을 저장했습니다.\n타이틀 「지난흔적」에서 이어 할 수 있습니다.`, [['확인', back]])
}

/** 중간 저장에서 이어 하기: 유닛·부대·발동 기록을 되돌리고 그 턴 아군 차례부터. 저장은 이 장을 이길 때까지 남는다 */
async function resumeAt(r: Suspended, all: Unit[]) {
  all.forEach((u, i) => { const v = r.units[i]; if (!v) return; const { onMap: _, ...rest } = v; Object.assign(u, rest, { px: v.x, py: v.y }); applyMods(u) })
  S.units = all.filter((_, i) => r.units[i]?.onMap ?? true)
  S.reserve = all.filter((_, i) => r.units[i] && !r.units[i].onMap)
  S.troopState = [...r.troopState]
  r.fired.forEach(i => S.fired.add(i))
  r.told.forEach(t => told.add(t))
  S.joined = [...r.joined]
  FLAGS.clear(); r.flags.forEach(f => FLAGS.add(f))
  beginLessons()   // 저장한 때까지 배운 것으로
  if (r.items) ITEMS.splice(0, ITEMS.length, ...r.items)
  r.taken?.forEach(i => taken.add(i))
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

/** 개선판 메뉴 「화면」: 위험 범위·미니맵·표기·화면 틀 켬/끔 (「소리」 창과 같은 모양). 바꿔도 창은 그대로, 「이전」 = 메뉴 */
function screenWin(back: () => void) {
  const opts: [string, () => boolean, () => void][] = [
    ['위험 범위', () => S.threat, toggleThreat],
    ['미니맵', minimapOn, toggleMinimap],
    ['표기', () => S.marks, () => { S.marks = !S.marks }],
    ['개선된 UI', () => view.modern, toggleScreenStyle],
  ]
  const open = (focus = 0) => {
    const el = openWin({ title: '화면', kind: 'screen', at: 'center', width: 216, dir: 'row', body: '<div class="snd"></div>', bodyH: opts.length * 29 - 2,
      buttons: [['이전', back]], onBack: () => { closeWin('screen'); back() } })
    const box = el.querySelector<HTMLElement>('.snd')!
    opts.forEach(([name, on, flip], i) => {
      const b = document.createElement('button')
      b.className = 'obtn opt'
      b.setAttribute('role', 'switch')
      b.setAttribute('aria-checked', String(on()))
      b.innerHTML = `${name}<b>${on() ? '켬' : '끔'}</b>`
      b.onclick = e => { e.stopPropagation(); flip(); open(i) }   // 화면 틀을 바꾸면 창 자리도 바뀌어 새로 연다
      box.append(b)
    })
    box.querySelectorAll<HTMLButtonElement>('button')[focus]?.focus({ preventScroll: true })
  }
  open()
}

/** 시스템 창. 원작: 알림·표기·음악·음향·조건·종료. 개선판: 목표·도움말·기록·화면·소리·턴 종료·정비 화면·중간 저장·타이틀로 (하위 창의 「이전」 = 이 창) */
function systemMenu(at?: { x: number; y: number }, from?: Unit) {
  const back = () => systemMenu(at, from)
  // 원작 [열기][닫기] (0aa2:0c58 모드 1) = 켜기·끄기 (開/關 를 글자대로 옮긴 번역으로 보고 고침). 지금 상태 쪽 버튼을 붉게, 닫기는 제목 ✕·Esc
  const onOff = (title: string, cur: () => boolean, set: (on: boolean) => void) => () => {
    const el = openWin({ title, dir: 'row', btnW: 54, kind: 'sub', at: 'center', buttons: [['켜기', () => set(true)], ['끄기', () => set(false)]], onBack: () => closeWin('sub') })
    el.querySelectorAll('.obtn').forEach((b, i) => b.classList.toggle('on', cur() === (i === 0)))
  }
  const items: Btn[] = remake() ? [
    ['목표', () => showGoalsWin(back, '이전')],
    ['도움말', () => rulesWin(battleKnown(), back, { extra: tipLog() })],   // 맨 앞 「안내 기록」 = 이 판에서 본 안내 카드
    ['기록', () => logWin(back)],
    ['화면', () => screenWin(back)],
    ['소리', () => soundWin(back)],
    ['턴 종료', confirmEnd, { disabled: !stepDone || S.mode.kind === 'busy' }],
    ['정비 화면', () => confirmWin('대기화면', 'center', toCamp)],
    ['중간 저장', () => {
      const old = loadSuspended(S.ed.id)   // 다른 장의 저장을 덮을 때만 묻는다
      if (old && (old.def.n !== S.def.n || old.def.route !== S.def.route)) confirmWin('중간 저장', 'center', () => midSave(back), back, `${esc(old.title)} 저장을 덮어씁니다.`, 220)
      else midSave(back)
    }, { disabled: !stepDone || S.mode.kind === 'busy' }],
    ['타이틀로', () => confirmWin('주화면', 'center', toTitle)],
  ] : [
    ['알림', onOff('알림전환', () => S.notice, on => { S.notice = on })],   // 공격·마법 확인창 켜기/끄기 (20ec:e911 → +0x1e6e, DOSBox 확인)
    ['표기', () => { S.marks = !S.marks; closeWin('system') }],
    ['음악', () => onOffVolumeWin('music', '음악전환')],   // 원작 +0x1cb3: 닫기 = 멈춤, 열기 = 그 곡 처음부터 (20ec:e969). 웹은 켜기·끄기, 소리만 끄고 켠다 (곡은 계속)
    ['음향', () => onOffVolumeWin('sound', '음향전환')],   // 원작 +0x1cb4 (효과음 전부). 웹은 설정 sound 로 기억
    ['조건', () => showGoalsWin()],
    ['종료', () => confirmWin('대기화면', 'center', toCamp)],
  ]
  openWin({ title: '시스템', buttons: items, kind: 'system', at: at ?? 'center', btnW: remake() ? 112 : 64, dim: true,
    closeOnPick: !!remake(), onBack: () => { closeWin('system'); if (from) commandMenu(from) } })   // 원작: 오른쪽 클릭 = 명령창으로
}

// ---------- 플레이어 명령 ----------

/** 유닛 오른쪽 옆 (원작: 창은 누른 유닛 오른쪽에 뜬다) */
const beside = (u: Pos) => { const { sx, sy } = toScreen(u.x + 1, u.y); return { x: sx + 4, y: sy } }

export function select(u: Unit) {
  const moves = reachable(S.map, S.units, u)
  S.mode = { kind: 'selected', unit: u, moves }
  // 통제 영역 안내 (tips.ts): 적 옆 칸 때문에 이동 범위가 줄어든 대원을 처음 골랐을 때. 지금 못 보이면 다음에 또
  if (remake() && S.ed.zoc && u.troop === 0 && !slips(u) && !seenTip('zoc') && reachable(S.map, S.units, u, false).size > moves.size) void tipNow('zoc')
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
    if (md.kind === 'targeting' && md.magic) { if (validCenter(md.unit, md.magic, t)) askMagic(md.unit, md.magic, t) }
    else if (md.kind === 'targeting' && there && canAim(md.unit, there)) askAttack(md.unit, there)
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
      // 이동 + 공격을 한 번에: 그 적을 맞히는 (칸, 중심) 중 아군을 덜 맞히고 가장 가까운 칸으로 (확인창 결정 뒤)
      const own = (p: { spot: Pos; center: Unit }) => strikeTargets(u, p.center, p.spot).filter(o => o.side === u.side).length
      const plan = strikePlans(u, md.moves, there).sort((a, b) => own(a) - own(b) || dist(a.spot, u) - dist(b.spot, u))[0]
      if (plan) { askAttack(u, plan.center, plan.spot, md.moves); return }
      S.watch = S.watch === there ? null : there
      return
    }
    if (md.moves.has(key(t.x, t.y))) { await moveTo(u, t); return }
    S.mode = { kind: 'idle' }   // 범위 밖 = 선택 풀기
    return
  }
  if (md.kind !== 'targeting') return
  if (md.magic) { if (validCenter(md.unit, md.magic, t)) askMagic(md.unit, md.magic, t); else back(); return }
  // 범위 공격은 맞을 적을 눌러도 된다 (그 적을 맞히는 중심 — 기사는 자기·아군, 포수는 다른 적)
  const c = there && (canAim(md.unit, there) ? there : aimsFrom(md.unit).find(c => strikeTargets(md.unit, c).includes(there) && there.side !== md.unit.side))
  if (c) askAttack(md.unit, c, undefined, undefined, md.power)
  else back()   // 대상이 아닌 칸 = 한 단계 뒤로 (행동 메뉴)
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
  if (!there || S.mode.kind === 'busy' || modalOpen() || (S.mode.kind === 'targeting' && S.mode.magic)) { hideBasic(); return }   // 마법 범위 미리보기를 가리지 않게
  const { sx, sy } = toScreen(there.x, there.y)
  showBasic(there, aboveUnit(sx, sy, 112), { extra: true })
}

/** 상성 (개선판 B1 제안 25) 확인창 꼬리표: 더 들면 「약점」, 덜 들면 「내성」 */
const affTag = (k: number) => k > 1 ? ' <span class="green">약점</span>' : k < 1 ? ' <span class="red">내성</span>' : ''
/** 장 환경 (B1 제안 26) 확인창 꼬리표: 환경 이름 (더 들면 초록, 덜 들면 빨강) */
const envTag = (k: number) => k === 1 ? '' : ` <span class="${k > 1 ? 'green' : 'red'}">${esc(stageTune()?.env?.name ?? '환경')} ${k > 1 ? '+' : '−'}${Math.round(Math.abs(k - 1) * 100)}%</span>`
/** 정비 화면 도구설명 칸: 장 환경 한 줄 */
const envLine = () => { const e = stageTune()?.env; return e ? `\n장 환경 · ${e.name} — ${e.text}` : '' }

/** 「전 투」 확인 (원작 DS:0x1f72). 개선판은 피해 예측을 창에 넣는다 (범위 공격은 맞는 유닛마다). target = 중심 유닛, spot = 개선판 이동+공격 때 설 칸.
 *  power = 전력 공격 (개선판 제안 27): 창 이름 「전력 공격」, 예측은 전력 피해로, 쌓일 피로 줄 */
function askAttack(u: Unit, target: Unit, spot?: Pos, moves?: ReturnType<typeof reachable>, power = false) {
  const cp = target === u ? spot ?? u : target
  S.aim = { x: cp.x, y: cp.y }
  hideBasic()
  let body: string | undefined
  let lines = 0
  u.power = power   // 예측 동안만 (피해·반격·피로 계산이 본다)
  if (S.ed.features.forecast) {
    const span = (a: number, b: number) => a === b ? `${a}` : `${a}~${b}`
    const hit = strikeTargets(u, target, spot ?? u)
    const flank = (t: Unit) => { const b = S.ed.rules.flank?.(u, t, S.units) ?? 0; return b ? ` <span class="green">협공 +${Math.round(b * 100)}%</span>` : '' }   // 제안 30
    const aff = (t: Unit) => affTag(S.ed.rules.affinity?.(u, t) ?? 1) + envTag(S.ed.rules.env?.(u) ?? 1)   // 상성 (제안 25-2): 활 → 비행, 장 환경 (제안 26)
    if (hit.length === 1 && hit[0] === target) {
      const [lo, hi] = S.ed.rules.damageRange(S.map, u, target, spot ?? u, S.units)
      const kill = lo >= target.hp ? '<span class="red">처치</span>' : hi >= target.hp ? '<span class="red">처치 가능</span>' : ''
      const back = counterDamage(u, target, spot ?? u)   // 제안 3: 되받는 피해
      body = [`${esc(target.type.name)}`, `피해 ${span(lo, hi)}${S.ed.rules.bane?.(u, target) ? ' <span class="green">특효</span>' : ''}${aff(target)}${flank(target)}`, `생명 ${target.hp} → ${span(Math.max(0, target.hp - hi), Math.max(0, target.hp - lo))}`, back ? `<span class="red">${back >= u.hp ? '반격에 쓰러짐' : `반격 −${back}`}</span>` : '', kill].filter(Boolean).join('<br>')
    } else {
      // 범위 공격: 한 줄에 한 유닛. 같은 편 (포수) 은 붉게
      body = hit.map(t => {
        const [lo] = S.ed.rules.damageRange(S.map, u, t, spot ?? u, S.units)
        const name = t.side === u.side ? `<span class="red">${esc(t.type.name)}</span>` : esc(t.type.name)
        return `${name} −${lo}${aff(t)}${flank(t)}${lo >= t.hp ? ' <span class="red">처치</span>' : ''}`
      }).join('<br>')
      lines = hit.length
    }
    if (power) {
      const tired = `피로 ${u.fatigue} → ${S.ed.rules.fatigueAfter(u, true)}`
      body = body ? `${body}<br>${tired}` : tired
      if (lines) lines++
    }
  }
  u.power = false
  const { sx, sy } = toScreen(cp.x + 1, cp.y)
  const go = () => {
    S.aim = null
    void (async () => {
      if (spot && moves) {
        const from = { x: u.x, y: u.y }
        S.mode = { kind: 'busy' }
        await walk(u, pathTo(moves, spot.x, spot.y))
        S.mode = { kind: 'targeting', unit: u, from }
      }
      await doAttack(u, target, power)
    })()
  }
  if (remake() ? setting('quickAttack') : !S.notice) { go(); return }   // 원작: 알림을 열었을 때만 확인 (기본 닫기), 개선판: 설정으로 생략
  confirmWin(power ? '전력 공격' : '전 투', { x: sx + 4, y: sy }, go, () => { S.aim = null }, body, lines ? 200 : undefined)
}

/** 원작판: 차례인 유닛을 누르면 여는 명령창 「명령」 (원작 20ec:eb81): [마법]·이동·전투·상황·시스템 (마법은 마법 있는 유닛만) */
export function commandMenu(u: Unit) {
  const here = { x: u.x, y: u.y }
  S.mode = { kind: 'idle' }
  showMenu([
    ...spellsOf(u).length ? [['마법', () => magicMenu(u, here, () => commandMenu(u))] as Btn] : [],
    ['이동', () => select(u)],
    ['전투', () => fightMode(u, here)],   // 원작: 사거리에 적이 없어도 들어간다
    ['상황', () => { const p = beside(u); showBasic(u, { x: p.x, y: p.y }, { onFace: () => bigStatus(u) }) }],
    ['시스템', () => systemMenu(beside(u), u)],
  ], beside(u).x, beside(u).y)
}

/** 큰 인물기본자료 (원작: 작은 창의 얼굴 아이콘 → 정비 화면 상태창과 같은 창) — 정비 화면 상태창을 맵 가운데에. onClose = 닫은 뒤 */
function bigStatus(u: Unit, onClose?: () => void) {
  hideBasic()
  void import('./camp').then(m => m.statusWindow(u.type, S.tables, { hp: u.hp, fatigue: u.fatigue, atk: u.atk, def: u.def, spi: u.spi, agi: u.agi }, onClose))
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
  const targets = aimsFrom(u)
  const magic: Btn[] = spellsOf(u).length ? [['마법', () => magicMenu(u, from, () => actionMenu(u, from))]] : []
  // 피로를 쓰는 명령 (개선판 B1 제안 27): 전력 공격 = 칠 대상이 있을 때, 방어 = 움직이지 않았을 때 (휴식 대신)
  const st = S.ed.rules.stance && !locked.has('stance')   // 1장은 2장 안내 전까지 빼 둔다 (core/lessons.ts)
  const power: Btn[] = st && targets.length ? [['전력 공격', () => { S.mode = { kind: 'targeting', unit: u, from, power: true } }]] : []
  const guard: Btn[] = st && !u.moved ? [['방어', () => finishUnit(u, false, undefined, true)]] : []
  const items: Btn[] = remake()
    ? [...targets.length ? [['공격', () => { S.mode = { kind: 'targeting', unit: u, from } }] as Btn] : [], ...power, ...magic, ...guard, ['대기', () => finishUnit(u)],
      ['상태', () => bigStatus(u, () => actionMenu(u, from))], ['취소', undo]]   // 상태 = 터치 기기용 (마우스는 올리면 작은 창)
    : [...magic, ['전투', () => fightMode(u, from)], ['결정', () => finishUnit(u)], ['취소', undo]]
  const p = beside(u)
  showMenu(items, p.x, p.y, remake() ? '행동' : '명령', () => { closeWin('menu'); undo() }, { x: false })   // 취소 버튼이 있다
}

export async function doAttack(u: Unit, target: Unit, power = false) {
  S.mode = { kind: 'busy' }
  hideMenu()
  hideBasic()
  if (power) {   // 전력 공격 (제안 27): 차례를 마칠 때 (tire) 풀린다
    u.power = true
    S.floats.push({ x: u.x, y: u.y - 0.4, text: '전력', t0: performance.now(), color: '#ffb04a' })
  }
  await attack(u, target)
  finishUnit(u, true)
}

// ---------- 마법 ----------

/** 고를 수 있는 중심 칸: 사거리 안이고 범위에 대상편이 있다. 원작판 '전투' 의 마법은 중심 칸 자체에 대상편이 서 있어야 (칸 표시 == 대상편, 20ec:0358) */
function validCenter(u: Unit, m: Magic, c: Pos) {
  if (m.echo) {
    const o = unitAt(c.x, c.y), foe = S.ed.rules.spellSide(m) === 'foe'
    if (m.id < 0 || !o || (foe ? o.side === u.side : o.side !== u.side)) return false
  }
  return inSpellRange(S.ed.rules, m, u, c) && spellTargets(S.ed.rules, u, m, c).length > 0
}

/** 마지막으로 마법 창에서 고른 마법 (원작 전투 구조체 0x1e30·0x1e64·0x1e66 — 124e:c194·c1ac·2fb7 에서 고를 때만 바뀜, AI 는 안 건드림).
 *  구조체는 프로그램을 켤 때 한 번 생겨 장·유닛을 넘어 남는다 → 웹은 페이지를 열어 둔 동안 (세이브에 없음) */
let lastSpell: Magic | null = null

/** 원작판 마법 직업 (공격 유형 1) 의 '전투' [확정 2026-10-22, 20ec:d900·ddd9·e3df → 6e92 종류 1 = 5c0f 마법]:
 *  마지막으로 고른 마법을 사거리 = 무기 f2 (0 이면 자기 칸만), 범위 = 무기 f3 로 다시 건다. 시전 조건 (피로) 은 보지 않고 피로는 마법식.
 *  마법 직업 무기 (장·책·부적·훈장·하프) 는 모두 f2 = 0 → 마지막 마법이 아군 대상이면 자기 칸 중심, 적 대상·처음 (0x1e64 = 0) 이면 고를 칸이 없다 */
function echoSpell(u: Unit): Magic {
  const w = S.tables.items.get(u.type.equip[0])
  const base = lastSpell ?? { id: -1, school: 0, name: '', range: 0, area: 0, effect: 0, power: 0, fatigue: 0 }
  return { ...base, range: w?.f2 ?? 1, area: w?.f3 ?? 0, echo: true }
}

/** 원작판 '전투' 칸 고르기. 마법 직업은 마지막 마법 (echoSpell) */
function fightMode(u: Unit, from: Pos) {
  S.mode = attackKind(u) === 1 && !remake() ? { kind: 'targeting', unit: u, from, magic: echoSpell(u) } : { kind: 'targeting', unit: u, from }
}

/** 마법 목록. 피로가 모자라면 (피로 + 마법 피로 > 90) 못 고른다.
 *  원작판: 「마법일람표」 창 (magicWinOriginal).
 *  개선판: 아이콘 (MAR 9) · 이름 · 효과 · 사거리·범위·피로를 늘 보이는 목록 (터치 기기는 올리기가 없어 설명을 숨기지 않는다). 못 쓰면 까닭을 붉게 */
function magicMenu(u: Unit, from: Pos, onBack: () => void) {
  const list = spellsOf(u)
  const usable = (m: Magic) => S.ed.rules.canCast(u, m) && (!remake() || spellCenters(S.ed.rules, u, m).length > 0)
  const pick = (m: Magic) => { closeWin('menu'); lastSpell = m; S.mode = { kind: 'targeting', unit: u, from, magic: m } }
  if (!remake()) { magicWinOriginal(list, usable, pick, beside(u), () => { closeWin('menu'); onBack() }); return }
  const m0 = mapRect(), ROW = 50
  const rows = list.map((m, i) => {
    const inf = spellInfo(S.ed.rules, m), ok = usable(m)
    const why = !S.ed.rules.canCast(u, m) ? '피로가 모자람' : !ok ? '닿는 대상 없음' : ''
    return `<button class="mgrow ${inf.side === '적' ? 'foe' : 'own'}" data-i="${i}" ${ok ? '' : 'aria-disabled="true"'}>
      <i class="mgicon" style="background-position:-${m.id * 32}px 0"></i>
      <span class="mgtop"><b>${esc(m.name)}</b><small class="mgsch">${schoolIcon(m.school)}</small><em class="mgfat">피로 +${m.fatigue}</em></span>
      <span class="mgsub">${why ? `<span class="mgwhy">${why}</span>` : `<span class="mgside">${inf.side}</span>${esc(inf.what)}`}<span class="mgmeta">사거리 ${inf.range} · ${inf.area}</span></span>
    </button>`
  }).join('')
  const pct = Math.min(100, u.fatigue / 90 * 100)
  const head = `<div class="mghead"><span>피로</span><span class="mgbar"><i style="width:${pct}%"></i></span><b>${u.fatigue} / 90</b></div>`
  const w = Math.min(340, m0.w - 16)
  const bodyH = Math.min(list.length * ROW + 30, m0.h - 70)
  const el = openWin({ title: '마법', kind: 'menu', at: beside(u), width: w, bodyH,
    body: `<div class="mglist">${head}${rows}</div>`, onBack: () => { closeWin('menu'); onBack() } })
  const btns = [...el.querySelectorAll<HTMLButtonElement>('.mgrow')]
  btns.forEach((b, i) => {
    const m = list[i]
    b.onclick = e => { e.stopPropagation(); if (b.getAttribute('aria-disabled')) return; pick(m) }
    b.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); closeWin('menu'); onBack() }
    b.onkeydown = e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault(); e.stopPropagation()
      btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length].focus()
    }
  })
  ;(btns.find(b => !b.getAttribute('aria-disabled')) ?? btns[0])?.focus({ preventScroll: true })
}

/** 원작판 「마법일람표」 (ECPMAG "magic", 124e:b5c6) [확정]: 바깥 157×184 (3cd3:53de 인자 = 바깥 크기), 안쪽 원점 (9,24) = 옆 변 폭·위 띠 높이 + 1.
 *  안쪽 좌표로: 아이콘 4열 (0,0)~ 33×41 간격 (0aa2:0435), y 90 검은 가름줄. 고른 마법 = 큰 아이콘 (10,100) + 검은 그림자 선 (x 42·y 140),
 *  이름 (55,103), 효과 이름 (55,123) 아군 효과 (0~6·14) 파랑·그 밖 빨강. 처음 고른 것 = 0번, 표시는 아래 칸뿐.
 *  아이콘 클릭 = 고르기, 큰 아이콘 클릭 = 흰 선 + 1px 밀림 200ms 뒤 시전, 오른쪽 클릭 = 취소.
 *  웹 보탬: 피로가 모자란 마법은 큰 아이콘이 흐리고 눌리지 않는다 (원작 창은 막지 않음, 피로 검사는 시전 처리 124e:3481 쪽 [추정]), ←→↑↓·Enter */
function magicWinOriginal(list: Magic[], usable: (m: Magic) => boolean, pick: (m: Magic) => void, at: Pos, onBack: () => void) {
  const W = 157, H = 184, X = 9, Y = 24
  const el = openWin({ kind: 'menu', at, width: W, body: ' ', bodyH: H - 44, onBack, x: true })
  el.classList.add('magicwin')
  el.style.backgroundImage = `url(${winUrl('magic', W, H)})`
  el.querySelector('.b')?.remove()
  const pos = (x: number, y: number) => `left:${X + x}px;top:${Y + y}px`
  el.insertAdjacentHTML('beforeend', list.map((m, i) =>
    `<button class="mgi" title="${esc(spellDesc(m))}" style="${pos(33 * (i % 4), 41 * Math.floor(i / 4))};background-position:-${m.id * 32}px 0"></button>`).join('')
    + `<i class="mgsep" style="${pos(0, 90)}"></i><button class="mgbig" style="${pos(10, 100)}"></button>`
    + `<span class="mgname" style="${pos(55, 103)}"></span><span class="mgfx" style="${pos(55, 123)}"></span>`)
  const big = el.querySelector<HTMLButtonElement>('.mgbig')!
  const name = el.querySelector<HTMLElement>('.mgname')!, fx = el.querySelector<HTMLElement>('.mgfx')!
  let sel = 0, busy = false
  const show = (i: number) => {
    sel = i
    const m = list[i]
    big.style.backgroundPosition = `-${m.id * 32}px 0`
    big.title = spellDesc(m)
    big.setAttribute('aria-label', m.name)
    big.toggleAttribute('aria-disabled', !usable(m))
    name.textContent = m.name
    fx.textContent = MAGIC_EFFECTS[m.effect] ?? ''
    fx.className = `mgfx ${m.effect <= 6 || m.effect === 14 ? 'own' : 'foe'}`
  }
  el.querySelectorAll<HTMLButtonElement>('.mgi').forEach((b, i) => { b.onclick = e => { e.stopPropagation(); if (!busy) show(i); big.focus({ preventScroll: true }) } })
  big.onclick = e => {
    e.stopPropagation()
    if (busy || big.hasAttribute('aria-disabled')) return
    busy = true
    big.classList.add('down')
    setTimeout(() => pick(list[sel]), 200)
  }
  el.onkeydown = e => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 }[e.key]
    if (d === undefined || busy) return
    e.preventDefault(); e.stopPropagation()
    if (sel + d >= 0 && sel + d < list.length) show(sel + d)
  }
  show(0)
  big.focus({ preventScroll: true })
}

/** 「마 법」 확인 (원작 DS:0x1f6a, 알림을 열었을 때만). 개선판은 대상마다 예측 줄 */
function askMagic(u: Unit, m: Magic, c: Pos) {
  S.aim = { x: c.x, y: c.y }
  hideBasic()
  let body: string | undefined
  if (S.ed.features.forecast) {
    // 종족 상성 (제안 25): 생명상해가 더 들면 「약점」, 덜 들면 「내성」
    const aff = (t: Unit) => affTag(S.ed.rules.affinity?.(u, t, m) ?? 1) + envTag(S.ed.rules.env?.(u, m) ?? 1)   // 장 환경 (제안 26)
    const lines = spellTargets(S.ed.rules, u, m, c).map(t => esc(hitLine(t, S.ed.rules.spell(u, t, m))) + aff(t))
    body = [esc(m.name), ...lines.slice(0, 6), ...lines.length > 6 ? [`외 ${lines.length - 6}명`] : []].join('<br>')
  }
  const go = () => { S.aim = null; void doMagic(u, m, c) }
  if (remake() ? setting('quickAttack') : !S.notice) { go(); return }
  const { sx, sy } = toScreen(c.x + 1, c.y)
  confirmWin(m.echo ? '전 투' : '마 법', { x: sx + 4, y: sy }, go, () => { S.aim = null }, body, body ? 240 : undefined)
}

async function doMagic(u: Unit, m: Magic, c: Pos) {
  S.mode = { kind: 'busy' }
  hideMenu()
  hideBasic()
  await castSpell(u, m, c)
  finishUnit(u, false, m)
}

/** 오른쪽 클릭·Esc 입구 (개선판은 맵·창 바깥 누르기도): 큰 상태창 → 떠 있는 창 → 맵 순서 */
export function goBack() {
  const big = document.querySelector<HTMLElement>('.bigstat')
  if (big) { big.click(); return }
  if (!winBack()) back()
}
