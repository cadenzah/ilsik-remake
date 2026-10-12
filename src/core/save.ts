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
