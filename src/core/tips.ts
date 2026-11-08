// 개선판 새 시스템 대화 안내 (tips-proposal.md). 새 규칙이 처음 일어난 그 순간에 인물 한 줄 (tips.ecs) + 안내 카드 (help.ts TIP_CARDS) — 판마다 한 번 (판 플래그 tip:키[:갈래]).
// 한 전투에 셋까지. 일어난 일은 한 차례에 하나 (넘치면 남겨 둔 것이 다음 차례로, 전투가 끝나면 버린다 — 일이 다시 일어나면 다시 쌓인다).
// 차례 시작에 까는 것 (호위·경계·상성·고대 병기·전력·방어·피로) 은 아직 아무도 움직이지 않은 때라 한 묶음으로 함께 보이고 한 차례 하나에 들지 않는다 (9절).
// 셈 밖: 1장 반격이 열린 때·승급 (레벨업 창 앞)·전투 뒤 것 (down·bench).
// 적 차례에 생긴 일은 쌓아 두었다가 다음 아군 차례 시작에, 아군 행동 중 생긴 일은 그 행동이 끝난 뒤에 (battle.ts flushTips 자리).
// 화자는 후보 중 출전해 살아 있는 첫 일행, 없으면 카드만. 설정 「이야기 속 안내」(tipLines)·「안내 카드」(tipCards). 원작판은 tips.ecs 가 없어 아무것도 하지 않는다.
// 다시 하기는 장 시작 플래그로 되돌아가므로 그 장에서 처음 본 안내는 다시 나온다 (레스다 회상과 같음)
import { FLAGS } from './campaign'
import type { UnitType } from './data'
import { locked } from './lessons'
import type { Unit } from './unit'
import { playDialogue, type Line } from './dialogue'
import { AFF_LEAD, AFF_LINE, AFF_NOTE, AFF_OPPOSE, helpKnown, rulesWin, tipCard, tipCardHtml, tipTagHtml, type HelpTopic, type TipCard } from './help'
import { loadProgress } from './save'
import { setting } from './settings'
import { S } from './state'
import { closeWin, openWin } from './ui'

export const TIP_KEYS = ['wake', 'counter', 'zoc', 'flank', 'stance', 'tired', 'foeRest', 'escort', 'affinity', 'promo', 'down', 'bench', 'ancient'] as const
export type TipKey = typeof TIP_KEYS[number]

const PER_BATTLE = 3
const BUNDLE: TipKey[] = ['escort', 'wake', 'affinity', 'ancient', 'stance', 'tired']   // 아군 차례 시작에 상태를 보고 까는 것 (battle.ts turnTips), 이 순서로
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

type Pending = { key: TipKey; variant?: string; name?: string; kinds?: string[] }   // kinds = 상성 갈래 (affinity)
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
  if (!seenTip('stance')) locked.add('stance')   // 전력 공격·방어 명령은 2장 안내와 함께 메뉴에 나온다
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
/** 상성은 갈래마다 (판 플래그 tip:affinity:갈래) */
const seenKind = (k: string) => FLAGS.has(`tip:affinity:${k}`)
const seen = (p: Pending) => p.key === 'affinity' ? !p.kinds?.some(k => !seenKind(k)) : seenTip(p.key)

/** 안내할 일이 일어났다: 아직 안 봤으면 쌓아 둔다 (보이는 것은 flushTips). 차례 시작에 까는 것은 지금 상태로 바꿔 둔다 */
export function noteTip(key: TipKey, variant?: string, name?: string, kinds?: string[]) {
  const p: Pending = { key, variant, name, kinds }
  if (!on() || seen(p)) return
  const was = pending.findIndex(q => q.key === key)
  if (was >= 0 && !BUNDLE.includes(key)) return
  if (was >= 0) pending[was] = p; else pending.push(p)
}

/** 상성 소개 (9절, battle.ts turnTips): 맵에 있는 적의 상성 갈래 중 아직 소개하지 않은 것을 차례 시작에 묶어서.
 *  일행에 생명상해 마법이나 활이 있어야 (상성은 그 둘에만 든다). 활 (archer) 은 날 수 있는 일행이 출전했을 때만 — 적 궁수가 그 대원에게 위험 */
export function affinityIntro(party: Unit[], foes: Unit[]) {
  const kindsOf = S.ed.affinityKinds
  if (!kindsOf) return
  const flyer = party.some(u => kindsOf(u.type).includes('fly'))
  const hits = party.some(u => kindsOf(u.type).includes('archer') || (u.type.magic ?? []).some(id => S.tables.magic.get(id)?.effect === 7))
  const kinds = [...new Set(foes.flatMap(f => kindsOf(f.type)))].filter(k => !seenKind(k) && (k === 'archer' ? flyer : hits))
  if (kinds.length) noteTip('affinity', undefined, undefined, kinds)
}

/** 쌓인 안내를 보인다. 차례 시작 묶음 (BUNDLE) 은 start 일 때만 모두 (한 전투 셋 안에서), 그다음 일어난 일 하나 (한 차례 하나).
 *  일어난 일은 반격을 먼저 — 한 공격에서 협공과 함께 생기면 협공이 셋째 자리를 차지해 반격이 밀렸다. force = 전투 뒤 (셈 없이 모두) */
export async function flushTips(force = false, start = false) {
  if (start) for (const key of BUNDLE) {
    const i = pending.findIndex(p => p.key === key)
    if (i < 0 || !on() || shown >= PER_BATTLE) continue
    const t = pending.splice(i, 1)[0]
    if (seen(t)) continue
    await show(t)
    shown++
  }
  while (on()) {
    if (!force && (shown >= PER_BATTLE || lastTurn === S.turn)) return
    const urgent = pending.findIndex(p => p.key === 'counter')
    const i = urgent >= 0 ? urgent : pending.findIndex(p => force || !BUNDLE.includes(p.key))
    if (i < 0) return
    const t = pending.splice(i, 1)[0]
    if (seen(t)) continue
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
  const kinds = t.key === 'affinity' ? (t.kinds ?? []).filter(k => !seenKind(k)) : []
  if (t.key === 'affinity') kinds.forEach(k => FLAGS.add(`tip:affinity:${k}`))
  else FLAGS.add(`tip:${t.key}${t.variant ? `:${t.variant}` : ''}`)
  const prev = S.mode
  S.mode = { kind: 'busy' }
  // 상성은 갈래마다 한 줄씩 (화자가 다를 수 있다), 카드는 한 장
  const said = !setting('tipLines') ? [] : t.key === 'affinity' ? kinds.map(k => speaker({ ...t, variant: k })) : [speaker(t)]
  const ls = said.filter((l): l is Line => !!l)
  if (ls.length) await playDialogue(ls)
  if (setting('tipCards')) await cardWin(t, t.key === 'affinity' ? affinityCard(kinds) : tipCard(t.key, t.variant))
  S.mode = prev
}

/** 상성 소개 카드: 공통 첫 줄 + 이 장에서 처음 보이는 갈래마다 한 줄 (help.ts AFF_LINE). 적마다 약점을 늘어놓지는 않는다 (2026-11-08 사용자: 과하게 친절) */
function affinityCard(kinds: string[]): TipCard | undefined {
  if (!kinds.length) return
  const one = tipCard('affinity', kinds[0])
  const points = kinds.map(k => AFF_LINE[k]).filter(Boolean)
  if (kinds.includes('caster')) points.push(AFF_OPPOSE)
  return { topic: 'affinity', title: kinds.length === 1 && one ? one.title : '상성', lead: AFF_LEAD, points, note: AFF_NOTE }
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
function cardWin(t: Pending, c: TipCard | undefined): Promise<void> {
  if (!c) return Promise.resolve()
  return new Promise(ok => {
    const el = openWin({
      title: c.title, kind: 'tip', at: 'center', width: 360, dir: 'row', fit: true,
      body: tipCardHtml(c),
      buttons: [['도움말에서 더 보기', () => rulesWin(battleKnown(), ok, { topic: c.topic, label: '닫기', extra: tipLog() })], ['닫기', ok]],
      onBack: () => { closeWin('tip'); ok() }, x: false,
    })
    el.querySelector('.t')?.insertAdjacentHTML('beforeend', tipTagHtml(t.key))
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
