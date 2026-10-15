// 진행 저장 (판마다 따로, localStorage). "다음에 할 장"과 그때의 장 사이 상태(플래그·일행·소지품), 클리어한 장을 남긴다
import type { Camp } from './campaign'
import type { StageDef } from './stage'
import type { BuffStat } from './unit'

export type EditionId = 'original' | 'remake'

export interface Progress {
  next: { n: number; route: number }     // 이어하기로 시작할 장
  cleared: { n: number; route: number; at?: Camp }[] // 장 선택에 나오는 장 (클리어 순). at = 그 장을 시작할 때 상태 (다시 하기용)
  flags: string[]
  party?: number[]                       // 없으면 (옛 저장) 초기 일행
  items?: number[]
  equip?: Camp['equip']
  grown?: Camp['grown']                  // 레벨업한 일행 대원 값
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
export const progressCamp = (p: Progress): Camp => ({ flags: p.flags, party: p.party ?? [], items: p.items ?? [], equip: p.equip, grown: p.grown })

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
  facing: 'down' | 'up' | 'left' | 'right'; alpha: number; onMap: boolean
  mods?: Record<BuffStat, number>; poison?: number; coma?: number; ticked?: boolean }   // 마법 상태 (없으면 없음)
export interface Suspended {
  def: StageDef; title: string; at: Camp; deploy: number[]
  turn: number; units: UnitSave[]; troopState: number[]; fired: number[]; told: string[]; joined: number[]; flags: string[]; saved: number
  grown?: Camp['grown']; equip?: Camp['equip']   // 이 전투에서 레벨업한 일행 값·승급한 장비 (at 은 장 시작 때라 따로)
}
const susKey = (ed: EditionId) => `eclipse.suspend.${ed}`
export function loadSuspended(ed: EditionId): Suspended | null {
  try { const raw = localStorage.getItem(susKey(ed)); return raw ? JSON.parse(raw) as Suspended : null } catch { return null }
}
export function writeSuspended(ed: EditionId, s: Suspended | null) {
  try { s ? localStorage.setItem(susKey(ed), JSON.stringify(s)) : localStorage.removeItem(susKey(ed)) } catch { /* 저장 불가 */ }
}

// ---------- 기록 옮기기 (다른 브라우저·기기로, 서버 없이 코드·파일로) ----------
// 옮기는 것 = 두 판의 진행 (이어하기·장 지도·도감)·기록 3칸·중단한 전투. 설정(글꼴·화면 등)은 기기마다라 옮기지 않는다.
// 코드 = "ECL1." + base64url(deflate-raw(JSON)). 압축을 못 쓰는 브라우저는 "ECL0." + base64url(JSON). 파일 = 같은 묶음의 JSON

export interface SaveBundle { app: 'eclipse-web'; v: 1; at: number; data: Record<string, unknown> }
const MOVABLE = /^eclipse\.(progress|slots|suspend)\.(original|remake)$/
const BACKUP = 'eclipse.backup'   // 가져오기 바로 전 상태 (한 번 되돌리기)

function collect(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (MOVABLE.test(k)) data[k] = JSON.parse(localStorage.getItem(k)!)
    }
  } catch { /* 읽기 불가 */ }
  return data
}

/** 지금 브라우저의 옮길 기록 */
export const currentBundle = (): SaveBundle => ({ app: 'eclipse-web', v: 1, at: Date.now(), data: collect() })

const b64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
const pipe = async (bytes: Uint8Array, t: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(t)).arrayBuffer())

export async function bundleCode(b: SaveBundle): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(b))
  if (typeof CompressionStream === 'undefined') return `ECL0.${b64(raw)}`
  return `ECL1.${b64(await pipe(raw, new CompressionStream('deflate-raw')))}`
}

/** 붙여 넣은 코드나 파일 글을 묶음으로. 잘못됐으면 까닭을 담은 Error */
export async function parseTransfer(text: string): Promise<SaveBundle> {
  const t = text.trim()
  let json: string
  if (t.startsWith('{')) json = t
  else {
    const m = /^ECL([01])\.([A-Za-z0-9_-]+)$/.exec(t.replace(/\s+/g, ''))
    if (!m) throw new Error('기록 코드가 아닙니다. "ECL1." 로 시작하는 글 전체를 붙여 넣어 주세요.')
    try {
      const bytes = unb64(m[2])
      json = new TextDecoder().decode(m[1] === '1' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes)
    } catch { throw new Error('코드가 잘렸거나 바뀌었습니다. 처음부터 끝까지 다시 복사해 주세요.') }
  }
  let b: SaveBundle
  try { b = JSON.parse(json) as SaveBundle } catch { throw new Error('기록 파일을 읽지 못했습니다.') }
  if (b?.app !== 'eclipse-web' || b.v !== 1 || typeof b.data !== 'object' || !b.data) throw new Error('이 게임의 기록이 아닙니다.')
  const keys = Object.keys(b.data)
  if (keys.some(k => !MOVABLE.test(k))) throw new Error('알 수 없는 항목이 들어 있습니다.')
  if (!keys.length) throw new Error('옮길 기록이 비어 있습니다.')
  return b
}

/** 가져오기: 지금 기록을 되돌리기용으로 남기고 묶음으로 바꾼다 (묶음에 없는 항목은 지운다) */
export function applyBundle(b: SaveBundle) {
  try {
    localStorage.setItem(BACKUP, JSON.stringify(currentBundle()))
    replaceAll(b.data)
  } catch { throw new Error('이 브라우저에 저장할 수 없습니다 (사생활 보호 모드 등).') }
}

function replaceAll(data: Record<string, unknown>) {
  const old: string[] = []
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (MOVABLE.test(k)) old.push(k) }
  old.forEach(k => localStorage.removeItem(k))
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v))
}

export function hasImportBackup() { try { return localStorage.getItem(BACKUP) !== null } catch { return false } }

/** 가져오기 되돌리기 (한 번) */
export function undoImport() {
  try {
    const raw = localStorage.getItem(BACKUP)
    if (!raw) return
    replaceAll((JSON.parse(raw) as SaveBundle).data)
    localStorage.removeItem(BACKUP)
  } catch { /* 무시 */ }
}
