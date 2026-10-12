// 캠페인: 장 사이에 이어지는 상태 (플래그·일행·소지품)와 원작 장면 재생 목록
import type { PostStep, UnitType } from './data'
import { S } from './state'

/** 장 사이 상태. 진행 저장(save.ts)에 그대로 들어간다 */
export interface Camp { flags: string[]; party: number[]; items: number[]; equip?: Record<number, Equip> }
type Equip = UnitType['equip']

// 캠페인 플래그 (npc19 = 19장 용왕 생존 → 36장 루이스 출현·합류, black27 = 27장 흑기사 출현 → 27장 후 아보라한 합류·장면)
export const FLAGS = new Set<string>()
export const PARTY: number[] = []   // 일행 유닛 종류, 순서 = 출전 칸 순서 (0번 = 선두, 쓰러지면 패배)
export const ITEMS: number[] = []   // 소지품 Item id
export const EQUIP = new Map<number, Equip>()   // 정비 화면에서 바꾼 일행 장비 (유닛 종류 → 장비). 없으면 PAD 기본 장비

/** 일행 대원의 종류 — 바꾼 장비를 덮어쓴 사본 */
export const partyType = (t: number): UnitType => {
  const e = EQUIP.get(t)
  return e ? { ...S.types[t], equip: e } : S.types[t]
}

export const snapshot = (): Camp => ({ flags: [...FLAGS], party: [...PARTY], items: [...ITEMS], equip: Object.fromEntries([...EQUIP].map(([t, e]) => [t, [...e] as Equip])) })

/** 상태를 바꿔 넣는다. 없는 값은 새 게임 기본값 — 빈 일행은 boot 가 원작 초기 일행으로 채운다 (scenes.json 로드 뒤).
 *  캠페인 밖에서 바로 연 장(장 선택 옛 기록·?stage=N)은 npc19 를 켜 둬 36장 루이스 장면을 볼 수 있게 한다 */
export function restore(c: Partial<Camp> | null) {
  FLAGS.clear()
  ;(c?.flags ?? (c ? [] : ['npc19'])).forEach(f => FLAGS.add(f))
  PARTY.splice(0, PARTY.length, ...(c?.party ?? []))
  ITEMS.splice(0, ITEMS.length, ...(c?.items ?? []))
  EQUIP.clear()
  Object.entries(c?.equip ?? {}).forEach(([t, e]) => EQUIP.set(Number(t), [...e] as Equip))
}

/** 소지품이나 일행 장비에 그 도구가 있나 (원작 [bp-0x1a4] 소지품 + 일행 장비 +0x5e 검사) */
export const hasItem = (id: number) => ITEMS.includes(id) || PARTY.some(t => S.types[t] && partyType(t).equip.includes(id))

export const joinLine = (type: number) => ({ text: `${S.types[type].name}이(가) 일행에 합류했다.` })

// 선택지 분기는 아직 UI 가 없어 '예'(1) 쪽을 재생한다
export function sceneLines(keys: string[]) {
  return keys.flatMap(k => S.scenes.scenes[k] ?? []).filter(([, , br]) => br !== 2)
    .map(([who, line]) => ({ who: who >= 0 ? S.types[who] : undefined, text: S.dialogue[line] }))
}

const applies = (s: PostStep) => (!s.routes || s.routes.includes(S.def.route)) && (!s.flag || FLAGS.has(s.flag))
  && (s.item === undefined || hasItem(s.item)) && (s.noItem === undefined || !hasItem(s.noItem))

export type Alive = (troop: number, member: number) => boolean
export type Note = { text: string }

/** 장면이 아닌 전투 후 단계 하나 (합류·이탈·교체·소지품·플래그). 합류 알림은 notes 에 */
export function applyStep(s: PostStep, notes: Note[], alive: Alive) {
  if ('join' in s) { PARTY.push(s.join); notes.push(joinLine(s.join)) }
  else if ('leave' in s) PARTY.splice(0, PARTY.length, ...PARTY.filter(t => t !== s.leave))
  else if ('swap' in s) PARTY.forEach((t, i) => { if (t === s.swap[0]) PARTY[i] = s.swap[1] })
  else if ('count' in s) PARTY.length = s.count                // 일행 배열 직접 대입 (8장 후 2명으로 재설정)
  else if ('set' in s) PARTY[s.set[0]] = s.set[1]
  else if ('take' in s) { const i = ITEMS.indexOf(s.take); if (i >= 0) ITEMS.splice(i, 1) }
  else if ('give' in s) ITEMS.push(s.give)
  else if ('setFlag' in s) { if (alive(...s.alive)) FLAGS.add(s.setFlag) }
  // promote (40장 레이몬 직업 단계 +0x62) 는 직업 단계가 아직 없어 건너뛴다
}

/** 승리 처리: 전투 중 합류(joined)·클리어 보상(reward, 추정)을 넣고, 전투 후 단계를 순서대로 실행해 일행·소지품·플래그를 고친다.
 *  돌려주는 scenes = 재생할 원작 장면 키, notes = 장면 뒤에 보일 합류 알림 (원작은 합류 처리 뒤 대화를 띄우지만 알림은 대화 끝에).
 *  ownSteps = 개선판 대본이 이 장의 캠페인 단계를 대신 쓴다 → 원작 단계(장면 포함)를 모두 건너뛴다 (script-format.md 3절) */
export function finishStage(joined: number[], reward: number[], alive: Alive, ownSteps = false) {
  PARTY.push(...joined)
  ITEMS.push(...reward)
  const scenes: string[] = [], notes: Note[] = []
  for (const s of ownSteps ? [] : S.scenes.post[S.def.n] ?? []) {
    if (!applies(s)) continue
    if ('scene' in s) scenes.push(s.scene)
    else applyStep(s, notes, alive)
  }
  return { scenes, notes }
}

export type Next = { n: number; route: number } | { choose: [number, number, number] } | null

/** 전투 순서표로 다음 장을 찾는다. 진로 선택 장(9장) 뒤면 루트별 첫 장 3개, 마지막 장이면 null */
export function nextStage(n: number, route: number): Next {
  const T = S.routeTable
  const i = T.findIndex((row, k) => k > 0 && row[route] === n)
  const row = T[i + 1]
  if (i < 0 || !row || row[route] === n) return null   // 29행은 43장 중복
  if (n === S.scenes.routeSelectAfter) return { choose: [row[0], row[1], row[2]] }
  return { n: row[route], route }
}
