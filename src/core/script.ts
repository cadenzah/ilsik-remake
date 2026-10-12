// 개선판 대본 (.ecs) 해석·실행 — 형식은 .claude/docs/script-format.md (2026-10-13 사용자 확정).
// 장 파일 하나 = 장 카드·보조 목표·장면 블록. 블록은 원작 장면을 통째로 대신하고, keep 자리에 원작 장면을 재생한다.
// 블록에 do 가 하나라도 있는 장은 원작 전투 후 캠페인 단계(합류·이탈·소지품) 전체를 대신한다.
import { FLAGS, PARTY, applyStep, hasItem, sceneLines, type Alive, type Note } from './campaign'
import type { PostStep, UnitType } from './data'
import { S } from './state'
import { playDialogue, showResult } from './ui'

// ---------- 형식 ----------

export type When = 'pre' | 'post' | 'turn' | 'troop' | 'dead' | 'hp' | 'win' | 'lose'
/** 조건 (모두 AND). route 0~2, in = 출전 중, party = 일행에 있음, alive = [부대, 번호] */
export interface Cond {
  route?: number[]; flag?: string[]; noFlag?: string[]; item?: number[]; noItem?: number[]
  in?: string[]; party?: string[]; noIn?: string[]; noParty?: string[]; alive?: [number, number][]
}
export type Entry =
  | { line: number; who: string[]; opt?: boolean; text?: string; ref?: number }   // who = 화자 후보 ('-' 초상 없음, '출전' 출전 동료). opt = "이름?" (없으면 생략). ref = 원작 줄
  | { line: number; keep: true }
  | { line: number; do: PostStep[] }
  | { line: number; choose: string[]; branches: Entry[][] }
export interface Block { when: When; arg?: string; cond: Cond; body: Entry[] }
/** 보조 목표 (제안 2). keep = 조건이 깨지면 실패, ok = 조건이 맞으면 달성, 조건 없음 = 표시만 */
export interface Goal { text: string; kind?: 'keep' | 'ok'; cond: Cond }
export interface Chapter { n: number; card?: [place: string, goal: string]; goals: Goal[]; blocks: Block[] }

export class ScriptError extends Error {
  constructor(file: string, line: number, msg: string) { super(`${file}:${line}: ${msg}`) }
}

const ROUTES: Record<string, number> = { A: 0, B: 1, C: 2 }
const WHENS = new Set<When>(['pre', 'post', 'turn', 'troop', 'dead', 'hp', 'win', 'lose'])

/** do 한 줄 ("join 페니, give 168") → 캠페인 단계. 이름은 실행 때가 아니라 여기서 번호로 (names 로) */
function parseDo(src: string, name: (s: string) => number, err: (m: string) => never): PostStep[] {
  return src.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const [op, ...a] = s.split(/\s+/)
    const num = (x?: string) => { const v = Number(x); if (!x || !Number.isInteger(v)) err(`숫자가 아님: ${x}`); return v }
    switch (op) {
      case 'join': return { join: name(a.join(' ')) }
      case 'leave': return { leave: name(a.join(' ')) }
      case 'swap': return { swap: [name(a[0]), name(a[1])] as [number, number] }
      case 'give': return { give: num(a[0]) }
      case 'take': return { take: num(a[0]) }
      case 'flag': return { setFlag: a[0], alive: [0, 0] as [number, number] }   // 선두는 늘 살아 있으므로 무조건 켬
      default: return err(`모르는 동작: ${op}`)
    }
  })
}

function parseCond(words: string[], name: (s: string) => number, err: (m: string) => never): Cond {
  const c: Cond = {}
  const add = <K extends keyof Cond>(k: K, v: NonNullable<Cond[K]>[number]) => { ((c[k] ??= [] as never) as unknown[]).push(v) }
  for (const w of words) {
    const m = /^(!?)(\w+)=(.+)$/.exec(w)
    if (!m) err(`조건 형식: ${w}`)
    const [, not, k, v] = m!
    if (k === 'route') v.split('|').forEach(r => { if (!(r in ROUTES)) err(`루트는 A·B·C: ${r}`); add('route', ROUTES[r]) })
    else if (k === 'flag') add(not ? 'noFlag' : 'flag', v)
    else if (k === 'item') add(not ? 'noItem' : 'item', Number(v))
    else if (k === 'in' || k === 'party') { name(v); add(not ? (k === 'in' ? 'noIn' : 'noParty') : k, v) }
    else if (k === 'alive') { const [t, n] = v.split('.').map(Number); add('alive', [t, n]) }
    else err(`모르는 조건: ${k}`)
  }
  return c
}

/** .ecs 글을 해석한다. names = 화자 이름 → 유닛 번호 (없는 이름은 오류) */
export function parseChapter(file: string, n: number, src: string, name: (s: string) => number | undefined): Chapter {
  const ch: Chapter = { n, goals: [], blocks: [] }
  let block: Block | null = null
  let choice: Extract<Entry, { choose: string[] }> | null = null
  let branch: Entry[] | null = null
  src.split('\n').forEach((raw, i) => {
    const no = i + 1
    const err = (m: string): never => { throw new ScriptError(file, no, m) }
    const id = (s: string) => name(s) ?? err(`모르는 인물: ${s}`)
    const indented = /^\s/.test(raw)
    const line = raw.replace(/\s+#.*$|^#.*$/, '').trim()   // 주석: 줄 첫 # 또는 공백 뒤 #
    if (!line) return
    if (!indented) { choice = null; branch = null }
    if (line.startsWith('card ')) {
      const [place, goal = ''] = line.slice(5).split('|').map(s => s.trim())
      ch.card = [place, goal]
    } else if (line.startsWith('goal ')) {
      const m = /^goal (.+?)(?:\s+(keep|ok)\s+(\S.*))?$/.exec(line)!
      ch.goals.push({ text: m[1].trim(), kind: m[2] as Goal['kind'], cond: m[3] ? parseCond(m[3].split(/\s+/), id, err) : {} })
    } else if (line.startsWith('==')) {
      const [w, ...rest] = line.slice(2).trim().split(/\s+/)
      if (w === 'keep') err('keep 은 블록 안에 한 줄로 쓴다')
      if (!WHENS.has(w as When)) err(`모르는 시점: ${w}`)
      const arg = ['turn', 'troop', 'dead', 'hp'].includes(w) ? rest.shift() ?? err(`${w} 뒤에 값이 필요`) : undefined
      if (w === 'hp' && !/^<\d+%$/.test(rest[0] ?? '')) err('hp 는 "== hp 인물 <30%" 꼴')
      const hp = w === 'hp' ? rest.shift() : undefined
      block = { when: w as When, arg: hp ? `${arg} ${hp}` : arg, cond: parseCond(rest, id, err), body: [] }
      ch.blocks.push(block)
    } else {
      if (!block) err('블록(== …) 밖의 줄')
      const into = branch ?? block!.body
      if (line.startsWith('? ')) {
        choice = { line: no, choose: line.slice(2).split('|').map(s => s.trim()), branches: [] }
        block!.body.push(choice)
        branch = null
      } else if (indented && choice && /^> \d+$/.test(line)) {
        const k = Number(line.slice(2))
        if (k < 1 || k > choice.choose.length) err(`선택지는 1~${choice.choose.length}`)
        branch = choice.branches[k - 1] = []
      } else if (line === 'keep') into.push({ line: no, keep: true })
      else if (line.startsWith('do ')) into.push({ line: no, do: parseDo(line.slice(3), id, err) })
      else {
        const m = /^([^:]+):\s*(.*)$/.exec(line) ?? err('"화자: 대사" 꼴이 아님')
        const opt = m[1].trim().endsWith('?')
        const who = m[1].trim().replace(/\?$/, '').split('|').map(s => s.trim())
        who.forEach(w => { if (w !== '-' && w !== '출전') id(w) })
        const r = /^=(\d+)(?:\s*~\s*(.*))?$/.exec(m[2])
        const o = opt ? { opt } : {}
        if (r && r[2] === undefined) into.push({ line: no, who, ...o, ref: Number(r[1]) })
        else if (r) into.push({ line: no, who, ...o, ref: Number(r[1]), text: r[2] })
        else if (!m[2]) err('대사가 비었다')
        else into.push({ line: no, who, ...o, text: m[2] })
      }
    }
  })
  return ch
}

// ---------- 화자 이름 ----------

/** 이름 → 유닛 번호. 같은 이름(아리크스 0/1, 아티스 25/26)은 지금 일행에 있는 쪽, "이름#번호" 로 명시. aliases = 표기 통일 (names.json) */
export function nameIndex(types: UnitType[], aliases: Record<string, string> = {}) {
  const by = new Map<string, number[]>()
  types.forEach(t => by.set(t.name, [...by.get(t.name) ?? [], t.id]))
  return (s: string, prefer: number[] = []): number | undefined => {
    const m = /^(.+)#(\d+)$/.exec(s)
    if (m) return types[Number(m[2])]?.name === (aliases[m[1]] ?? m[1]) ? Number(m[2]) : undefined
    const ids = by.get(aliases[s] ?? s)
    return ids?.find(id => prefer.includes(id)) ?? ids?.[0]
  }
}

// ---------- 실행 ----------

// 출전 중인 일행. 전투 후(post)에는 쓰러진 대원도 그 자리에 있던 것으로 본다 (원작은 쓰러져도 일행에 남는다)
let afterBattle = false
const deployed = () => S.units.filter(u => u.troop === 0 && (afterBattle || u.hp > 0)).map(u => u.type.id)

function test(c: Cond, name: (s: string, prefer?: number[]) => number | undefined, alive: Alive) {
  const inParty = (s: string) => { const id = name(s, PARTY); return id !== undefined && PARTY.includes(id) }
  const isIn = (s: string) => { const id = name(s, deployed()); return id !== undefined && deployed().includes(id) }
  return (!c.route || c.route.includes(S.def.route)) && (c.flag ?? []).every(f => FLAGS.has(f)) && !(c.noFlag ?? []).some(f => FLAGS.has(f))
    && (c.item ?? []).every(hasItem) && !(c.noItem ?? []).some(hasItem)
    && (c.in ?? []).every(isIn) && !(c.noIn ?? []).some(isIn)
    && (c.party ?? []).every(inParty) && !(c.noParty ?? []).some(inParty) && (c.alive ?? []).every(([t, m]) => alive(t, m))
}

type Line = { who?: UnitType; text: string }

/** 블록들을 차례로 재생. keep = 원작 장면 키 (keep 자리에 재생), alive = 전투 후면 대원 생존 판정 */
export async function runBlocks(blocks: Block[], keep: string[], alive: Alive, name: (s: string, prefer?: number[]) => number | undefined) {
  let buf: Line[] = []
  const flush = async () => { if (buf.length) { const b = buf; buf = []; await playDialogue(b) } }
  let last: number | undefined
  const speaker = (who: string[], opt?: boolean): UnitType | null | undefined => {   // null = 줄 생략
    if (who.length === 1 && !opt && who[0] !== '출전') return who[0] === '-' ? undefined : S.types[name(who[0], [...deployed(), ...PARTY])!]
    for (const w of who) {
      if (w === '-') return undefined
      if (w === '출전') {   // 출전 동료 중 하나 (선두·직전 화자 말고, 출전 순서대로)
        const pick = deployed().find(id => id !== PARTY[0] && id !== last)
        if (pick !== undefined) return S.types[pick]
        continue
      }
      const id = name(w, deployed())
      if (id !== undefined && deployed().includes(id)) return S.types[id]
    }
    return null
  }
  const run = async (body: Entry[]) => {
    for (const e of body) {
      if ('keep' in e) buf.push(...sceneLines(keep))
      else if ('do' in e) {
        const notes: Note[] = []
        e.do.forEach(s => applyStep(s, notes, alive))
        buf.push(...notes)
      } else if ('choose' in e) {
        await flush()
        const k = await new Promise<number>(ok => showResult('선택', '', e.choose.map((c, i): [string, () => void] => [c, () => ok(i)])))
        await run(e.branches[k] ?? [])
      } else {
        const who = speaker(e.who, e.opt)
        if (who === null) continue
        last = who?.id
        buf.push({ who, text: e.text ?? S.dialogue[e.ref!] ?? '' })
      }
    }
  }
  for (const b of blocks) {
    afterBattle = b.when === 'post'
    if (test(b.cond, name, alive)) await run(b.body)
  }
  afterBattle = false
  await flush()
}

/** 그 시점의 블록 (조건 검사는 runBlocks 가). 없으면 빈 배열 = 원작 그대로 */
export const blocksAt = (ch: Chapter | undefined, when: When, arg?: string) =>
  ch?.blocks.filter(b => b.when === when && (arg === undefined || b.arg === arg)) ?? []

export type GoalState = 'open' | 'done' | 'failed'
/** 보조 목표의 지금 상태 (전투 중 목표 창) */
export function goalStates(alive: Alive): { text: string; state: GoalState }[] {
  return (chapter()?.goals ?? []).map(g => {
    if (!g.kind) return { text: g.text, state: 'open' }
    const hold = test(g.cond, names, alive)
    return { text: g.text, state: g.kind === 'ok' ? (hold ? 'done' : 'open') : (hold ? 'open' : 'failed') }
  })
}

/** 이 장의 대본이 원작 캠페인 단계를 대신하나 (do 가 하나라도 있으면) */
export function ownsSteps(ch: Chapter | undefined) {
  const has = (body: Entry[]): boolean => body.some(e => 'do' in e || ('choose' in e && e.branches.some(b => b && has(b))))
  return !!ch?.blocks.some(b => has(b.body))
}


// ---------- 판과 연결 ----------

let chapters = new Map<number, Chapter>()
let names: ReturnType<typeof nameIndex> = () => undefined
let loadedFor: object | null = null

/** 판의 대본 파일을 한 번 해석해 둔다 (유닛 표가 있어야 이름을 번호로). 문법 오류는 그대로 던진다 */
export function initScript(src: { files: Record<string, string>; aliases?: Record<string, string> } | undefined, types: UnitType[]) {
  if (loadedFor === (src ?? null) && chapters.size) return
  loadedFor = src ?? null
  chapters = new Map()
  names = nameIndex(types, src?.aliases)
  for (const [path, text] of Object.entries(src?.files ?? {})) {
    const n = Number(/(\d+)\.ecs$/.exec(path)?.[1])
    if (n) chapters.set(n, parseChapter(path, n, text, s => names(s)))
  }
}

export const chapter = (n = S.def.n) => chapters.get(n)

/** 그 시점의 이야기를 재생: 대본 블록이 있으면 그것 (keep = 원작 장면), 없으면 원작 장면 그대로. extra = 끝에 붙일 줄 (합류 알림 등) */
export async function story(when: When, keep: string[], alive: Alive, arg?: string, extra: Note[] = []) {
  const blocks = blocksAt(chapter(), when, arg)
  if (!blocks.length) { if (keep.length || extra.length) await playDialogue([...sceneLines(keep), ...extra]); return }
  await runBlocks(blocks, keep, alive, names)
  if (extra.length) await playDialogue(extra)
}
