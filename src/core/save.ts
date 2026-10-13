// 진행 저장 (판마다 따로, localStorage). "다음에 할 장"과 그때의 장 사이 상태(플래그·일행·소지품), 클리어한 장을 남긴다
import type { Camp } from './campaign'
import type { StageDef } from './stage'

export type EditionId = 'original' | 'remake'

export interface Progress {
  next: { n: number; route: number }     // 이어하기로 시작할 장
  cleared: { n: number; route: number; at?: Camp }[] // 장 선택에 나오는 장 (클리어 순). at = 그 장을 시작할 때 상태 (다시 하기용)
  flags: string[]
  party?: number[]                       // 없으면 (옛 저장) 초기 일행
  items?: number[]
  equip?: Camp['equip']
  // 다시 하기·진엔딩 (replay.ts, 개선판에서 씀)
  branch?: Camp                          // 진로 선택 직전 장(9장)을 클리어한 상태
  branchNext?: [number, number, number]  // 그 뒤 루트별 첫 장
  endings?: number[]                     // 엔딩을 본 루트
  found?: string[]                       // 찾은 조건 사건 (replay.FOUND id)
  seen?: { units: number[]; items: number[] }   // 도감
  carry?: { equip: Camp['equip']; items: number[] }   // 마지막 엔딩 때 장비 ("다른 길로" 이어받기)
  hidden?: number[]                      // 깬 숨은 장 (44·45, 45 = 진엔딩)
}

/** 이어하기 상태 */
export const progressCamp = (p: Progress): Camp => ({ flags: p.flags, party: p.party ?? [], items: p.items ?? [], equip: p.equip })

const key = (ed: EditionId) => `eclipse.progress.${ed}`

export function loadProgress(ed: EditionId): Progress | null {
  try {
    const raw = localStorage.getItem(key(ed))
    return raw ? JSON.parse(raw) as Progress : null
  } catch { return null }
}

function store(ed: EditionId, p: Progress) {
  try { localStorage.setItem(key(ed), JSON.stringify(p)) } catch { /* 저장 불가 (사생활 보호 모드 등) — 진행은 계속 */ }
}

/** 새로 시작: 다음 장을 1장으로 되돌린다. 클리어 기록(장 선택)은 남긴다 */
export function resetProgress(ed: EditionId) {
  store(ed, { next: { n: 1, route: 0 }, cleared: loadProgress(ed)?.cleared ?? [], flags: [] })
}

/** 장 클리어 기록. at = 그 장 시작 때 상태, now = 클리어 뒤 상태. next 가 없으면 (엔딩) 다음 장은 그대로 둔다 */
export function recordClear(ed: EditionId, def: StageDef, next: { n: number; route: number } | null, at: Camp, now: Camp) {
  const p = loadProgress(ed) ?? { next: { n: 1, route: 0 }, cleared: [], flags: [] }
  const c = p.cleared.find(c => c.n === def.n && c.route === def.route)
  if (c) c.at = at
  else p.cleared.push({ n: def.n, route: def.route, at })
  if (next) p.next = next
  Object.assign(p, now)
  store(ed, p)
}

const LAST_ED = 'eclipse.edition'
export function lastEdition(): EditionId {
  try { return localStorage.getItem(LAST_ED) === 'original' ? 'original' : 'remake' } catch { return 'remake' }
}
export function setLastEdition(ed: EditionId) {
  try { localStorage.setItem(LAST_ED, ed) } catch { /* 무시 */ }
}

/** 판을 넘어 쌓이는 기록 (클리어마다). branchNext 가 있으면 지금 상태를 분기점으로, ending 이면 그 루트 엔딩과 이어받을 장비 */
export function recordRun(ed: EditionId, r: { route: number; now: Camp; branchNext?: [number, number, number]; ending?: { carry: Progress['carry'] }
  found: string[]; seenUnits: number[]; seenItems: number[] }) {
  const p = loadProgress(ed) ?? { next: { n: 1, route: 0 }, cleared: [], flags: [] }
  const union = (a: number[] = [], b: number[]) => [...new Set([...a, ...b])].sort((x, y) => x - y)
  if (r.branchNext) { p.branch = r.now; p.branchNext = r.branchNext }
  if (r.ending) { p.endings = union(p.endings, [r.route]); p.carry = r.ending.carry }
  p.found = [...new Set([...p.found ?? [], ...r.found])]
  p.seen = { units: union(p.seen?.units, r.seenUnits), items: union(p.seen?.items, r.seenItems.filter(Boolean)) }
  store(ed, p)
}

/** "다른 길로": 분기점에서 그 루트 첫 장을 이어하기로 두고 시작 상태를 돌려준다 */
export function startOtherRoad(ed: EditionId, route: number, camp: Camp): { n: number; route: number } | null {
  const p = loadProgress(ed)
  if (!p?.branchNext) return null
  const next = { n: p.branchNext[route], route }
  Object.assign(p, { next }, camp)
  store(ed, p)
  return next
}

/** 숨은 장 클리어 (진행 저장과 따로, 장 지도의 기억 속의 장소·진엔딩 표식) */
export function recordHidden(ed: EditionId, n: number) {
  const p = loadProgress(ed) ?? { next: { n: 1, route: 0 }, cleared: [], flags: [] }
  p.hidden = [...new Set([...p.hidden ?? [], n])].sort((a, b) => a - b)
  store(ed, p)
}

// ---------- 기록 3칸 (원작 정비 화면 읽기·기록, 타이틀 지난흔적 — ux-proposal.md 21) ----------

/** 정비 화면에서 남긴 기록: 그 장 정비 화면부터 다시 */
export interface SaveSlot { n: number; route: number; title: string; camp: Camp; at: number }
export const SLOTS = 3
const slotKey = (ed: EditionId) => `eclipse.slots.${ed}`

export function loadSlots(ed: EditionId): (SaveSlot | null)[] {
  try {
    const raw = JSON.parse(localStorage.getItem(slotKey(ed)) ?? '[]') as (SaveSlot | null)[]
    return Array.from({ length: SLOTS }, (_, i) => raw[i] ?? null)
  } catch { return Array(SLOTS).fill(null) }
}

export function writeSlot(ed: EditionId, i: number, slot: SaveSlot) {
  const all = loadSlots(ed)
  all[i] = slot
  try { localStorage.setItem(slotKey(ed), JSON.stringify(all)) } catch { /* 저장 불가 */ }
}

// ---------- 중단 저장 (개선판 전투 중 메뉴 → 중단, ux-proposal.md 21). 이어하기 때 불러오고 지운다 ----------

export interface UnitSave { x: number; y: number; hp: number; fatigue: number; acted: boolean; moved: boolean; steps: number
  facing: 'down' | 'up' | 'left' | 'right'; alpha: number; onMap: boolean }
export interface Suspended {
  def: StageDef; title: string; at: Camp; deploy: number[]
  turn: number; units: UnitSave[]; troopState: number[]; fired: number[]; told: string[]; joined: number[]; flags: string[]; saved: number
}
const susKey = (ed: EditionId) => `eclipse.suspend.${ed}`
export function loadSuspended(ed: EditionId): Suspended | null {
  try { const raw = localStorage.getItem(susKey(ed)); return raw ? JSON.parse(raw) as Suspended : null } catch { return null }
}
export function writeSuspended(ed: EditionId, s: Suspended | null) {
  try { s ? localStorage.setItem(susKey(ed), JSON.stringify(s)) : localStorage.removeItem(susKey(ed)) } catch { /* 저장 불가 */ }
}
