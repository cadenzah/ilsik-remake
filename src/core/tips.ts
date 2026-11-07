// 개선판 새 시스템 대화 안내 (tips-proposal.md). 새 규칙이 처음 일어난 그 순간에 인물 한 줄 (tips.ecs) + 안내 카드 (help.ts TIP_CARDS) — 판마다 한 번 (판 플래그 tip:키[:갈래]).
// 한 차례에 하나, 한 전투에 셋까지 (넘치면 남겨 둔 것이 다음 차례로, 전투가 끝나면 버린다 — 일이 다시 일어나면 다시 쌓인다). 전투 뒤 것 (down·bench) 은 셈에서 뺀다.
// 적 차례에 생긴 일은 쌓아 두었다가 다음 아군 차례 시작에, 아군 행동 중 생긴 일은 그 행동이 끝난 뒤에 (battle.ts flushTips 자리).
// 화자는 후보 중 출전해 살아 있는 첫 일행, 없으면 카드만. 설정 「이야기 속 안내」(tipLines)·「안내 카드」(tipCards). 원작판은 tips.ecs 가 없어 아무것도 하지 않는다.
// 다시 하기는 장 시작 플래그로 되돌아가므로 그 장에서 처음 본 안내는 다시 나온다 (레스다 회상과 같음)
import { FLAGS } from './campaign'
import type { UnitType } from './data'
import { locked } from './lessons'
import type { Unit } from './unit'
import { playDialogue, type Line } from './dialogue'
import { helpKnown, rulesWin, tipCard, tipCardHtml, tipTagHtml, type HelpTopic } from './help'
import { loadProgress } from './save'
import { setting } from './settings'
import { S } from './state'
import { closeWin, openWin } from './ui'

export const TIP_KEYS = ['wake', 'counter', 'zoc', 'flank', 'stance', 'tired', 'foeRest', 'escort', 'undead', 'resist', 'caster', 'arrow', 'heavy', 'promo', 'down', 'bench', 'ancient'] as const
export type TipKey = typeof TIP_KEYS[number]

const PER_BATTLE = 3
const STANDING: TipKey[] = ['escort', 'wake', 'ancient', 'heavy', 'stance', 'tired']   // 아군 차례 시작에 상태를 보고 쌓는 것 (battle.ts turnTips)
const RECALL = '레스다 (회상)'

let lines = new Map<string, [name: string, text: string][]>()   // "키" 또는 "키 갈래" → 화자 후보

/** tips.ecs 해석: "@ 키 [갈래]" 아래 "화자: 대사". 모르는 키·인물은 던진다 */
export function initTips(src: string | undefined, types: UnitType[]) {
  lines = new Map()
  if (!src) return
  const known = new Set(types.map(t => t.name))
  let cur: [string, string][] | null = null
  src.split('\n').forEach((raw, i) => {
    const line = raw.replace(/^#.*$/, '').trim()
    if (!line) return
    const err = (m: string): never => { throw new Error(`tips.ecs ${i + 1}: ${m}`) }
    if (line.startsWith('@')) {
      const [key, variant] = line.slice(1).trim().split(/\s+/)
      if (!TIP_KEYS.includes(key as TipKey)) err(`모르는 키: ${key}`)
      const k = variant ? `${key} ${variant}` : key
      cur = lines.get(k) ?? []
      lines.set(k, cur)
      return
    }
    const m = /^([^:]+):\s*(.+)$/.exec(line) ?? err('"화자: 대사" 꼴이 아님')
    const who = m[1].trim()
    if (!known.has(who === RECALL ? '레스다' : who)) err(`모르는 인물: ${who}`)
    if (!cur) err('@ 키 줄이 먼저 와야 한다')
    cur!.push([who, m[2]])
  })
}

type Pending = { key: TipKey; variant?: string; name?: string }
const pending: Pending[] = []
let shown = 0, lastTurn = -1

/** 새 전투: 쌓인 안내·셈을 비운다 */
export function resetTips() { pending.length = 0; shown = 0; lastTurn = -1 }

const on = () => lines.size > 0 && (setting('tipLines') || setting('tipCards'))

/** 1장 차례차례 배우기 (core/lessons.ts, tips-proposal.md 7절): 안내가 켜진 판의 1장에서 아직 안 배운 반격·협공을 잠근다.
 *  전투 시작·중간 저장에서 이어 하기 (판 플래그를 되돌린 뒤) 에 부른다. 2장부터·안내 끔·원작판은 잠그지 않는다 */
export function beginLessons() {
  locked.clear()
  if (!on() || S.def?.n !== 1) return
  if (!seenTip('counter')) locked.add('counter')
  if (!seenTip('flank')) locked.add('flank')
}

/** 적이 처음 일행을 칠 때 (battle.ts attack, 되받기 판단 전): 반격을 열어 본다. 이번 공격을 되받을 수 있을 때만 열고 true
 *  — 그 자리에서 되받고 바로 안내 (openedTip). 활처럼 되받지 못하는 공격이면 잠근 채 다음 근접 공격을 기다린다 */
export function openCounter(a: Unit, c: Unit, can: () => boolean): boolean {
  if (!locked.has('counter') || a.side !== 'enemy' || c.troop !== 0) return false
  locked.delete('counter')
  if (can()) return true
  locked.add('counter')
  return false
}
/** 방금 열린 반격: 적 차례 중이라도 그 자리에서 (셈 밖). 레스다가 「방금 그것」 을 짚는다 */
export const counterOpened = () => tipNow('counter', 'open', undefined, true)

/** 반격을 배운 뒤 첫 아군 차례 (battle.ts turnTips): 협공을 열고 소개 — 쓰기 전에 알려 준다 */
export function openFlank() {
  if (!locked.has('flank') || !seenTip('counter')) return
  locked.delete('flank')
  noteTip('flank', 'open')
}
/** 이 판에서 이미 본 안내인가 (갈래와 상관없이) */
export const seenTip = (key: TipKey) => [...FLAGS].some(f => f === `tip:${key}` || f.startsWith(`tip:${key}:`))

/** 안내할 일이 일어났다: 아직 안 봤으면 쌓아 둔다 (보이는 것은 flushTips) */
export function noteTip(key: TipKey, variant?: string, name?: string) {
  if (!on() || seenTip(key) || pending.some(p => p.key === key)) return
  pending.push({ key, variant, name })
}

/** 쌓인 안내를 하나 보인다 (한 차례 하나·한 전투 셋). force = 전투 뒤 (셈 없이 모두) */
export async function flushTips(force = false) {
  while (pending.length && on()) {
    if (!force && (shown >= PER_BATTLE || lastTurn === S.turn)) return
    // 방금 일어난 일 (반격·협공·상성…) 을 장 내내 깔린 것 (경계·전력·방어·중갑…) 보다 먼저. 호위는 장 시작에 가장 먼저.
    // 반격은 일어난 일 중에서도 먼저 — 한 공격에서 협공과 함께 생기면 협공이 1장 셋째 자리를 차지해 반격이 2장으로 밀렸다 (2026-11-07 1~10장 돌려 봄)
    const urgent = pending.findIndex(p => p.key === 'counter')
    const ev = urgent >= 0 ? urgent : pending.findIndex(p => !STANDING.includes(p.key))
    const t = pending.splice(pending[0].key === 'escort' || ev < 0 ? 0 : ev, 1)[0]
    if (seenTip(t.key)) continue
    await show(t)
    if (!force) { shown++; lastTurn = S.turn; return }
  }
}

/** 바로 보인다 (그 자리에서 일어난 일: 통제 영역·승급·전투 뒤). 지금 못 보이면 (한 차례 하나·한 전투 셋) 버린다 — 일이 다시 일어날 때 또.
 *  force = 셈 없이 이것 하나만 (쌓인 다른 안내는 그대로 둔다) */
export async function tipNow(key: TipKey, variant?: string, name?: string, force = false) {
  if (!on() || seenTip(key)) return
  const was = pending.findIndex(p => p.key === key)
  if (was >= 0) pending.splice(was, 1)
  if (force) return show({ key, variant, name })
  pending.unshift({ key, variant, name })
  await flushTips(force)
  const left = pending.findIndex(p => p.key === key)
  if (left >= 0) pending.splice(left, 1)
}

async function show(t: Pending) {
  FLAGS.add(`tip:${t.key}${t.variant ? `:${t.variant}` : ''}`)
  const prev = S.mode
  S.mode = { kind: 'busy' }
  const l = setting('tipLines') ? speaker(t) : null
  if (l) await playDialogue([l])
  if (setting('tipCards')) await cardWin(t)
  S.mode = prev
}

/** 후보 중 출전해 살아 있는 첫 일행. 「레스다 (회상)」 = 9~43장에서 살아 있는 레스다가 없을 때 */
function speaker(t: Pending): Line | null {
  const cands = (t.variant && lines.get(`${t.key} ${t.variant}`)) || lines.get(t.key) || []
  for (const [who, text] of cands) {
    const say = text.replace(/\{name\}/g, t.name ?? '')
    if (who === RECALL) {
      const live = S.units.some(u => u.troop === 0 && u.hp > 0 && u.type.name === '레스다')
      const resda = S.types.find(x => x.name === '레스다')
      if (!live && resda && S.def.n >= 9 && S.def.n <= 43) return { who: { ...resda, name: RECALL }, text: say }
      continue
    }
    const u = S.units.find(u => u.troop === 0 && u.hp > 0 && u.type.name === who)
    if (u) return { who: u.type, text: say }
  }
  return null
}

/** 도움말이 쓰는 「만난 것」 (전투 중: 도감 기록 + 이 전투의 유닛) */
export const battleKnown = () => helpKnown([...loadProgress(S.ed.id)?.seen?.units ?? [], ...S.units.map(u => u.type.id)], S.tables.types, S.tables.labels.race)

/** 안내 카드: 제목 = 시스템 이름, 글 = 도움말 그 주제에서. 「도움말에서 더 보기」 = 그 주제를 연 도움말 (닫으면 전투로) */
function cardWin(t: Pending): Promise<void> {
  const c = tipCard(t.key, t.variant)
  if (!c) return Promise.resolve()
  return new Promise(ok => {
    const el = openWin({
      title: c.title, kind: 'tip', at: 'center', width: 360, dir: 'row',
      body: tipCardHtml(c),
      buttons: [['도움말에서 더 보기', () => rulesWin(battleKnown(), ok, { topic: c.topic, label: '닫기', extra: tipLog() })], ['닫기', ok]],
      onBack: () => { closeWin('tip'); ok() }, x: false,
    })
    el.querySelector('.t')?.insertAdjacentHTML('beforeend', tipTagHtml(t.variant ? `${t.key}:${t.variant}` : t.key))
    const gone = setInterval(() => { if (!el.isConnected && !document.querySelector('.owin.rules')) { clearInterval(gone); ok() } }, 300)   // 다른 일 (closeAll) 이 창을 치워도 멈추지 않게
  })
}

/** 전투 메뉴 도움말 맨 앞 「안내 기록」: 이 판에서 본 카드를 본 순서대로 */
export function tipLog(): HelpTopic[] {
  const seen = [...FLAGS].filter(f => f.startsWith('tip:')).map(f => f.slice(4).split(':'))
  const cards = seen.map(([k, v]) => ({ c: tipCard(k, v), tag: tipTagHtml(v ? `${k}:${v}` : k) })).filter(x => x.c)
  if (!cards.length) return []
  return [{ key: 'tips', title: '안내 기록', summary: '이 판에서 본 안내입니다. 본 순서대로 모았습니다.',
    core: cards.map(({ c, tag }) => ({ html: () => `<b>${c.title}</b>${tag}<br>${tipCardHtml(c)}` })) }]
}
