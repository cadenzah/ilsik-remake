// 개선판 적 차례 요약·전투 기록 (B1 제안 N6, balance-proposal.md).
// 페이즈제라 적 14~30명이 잇달아 움직여 무슨 일이 있었는지 놓친다 → 아군 차례가 끝날 때와 다음 아군 차례가 시작할 때 전장을 찍어 두고,
// 그 사이 바뀐 것 (맞은 아군·쓰러진 아군·쓰러진 적·중독·혼수·깨어난 부대·증원) 을 한 줄로 메뉴 「기록」 에 남긴다.
// 맵에 띄우는 판도 만들었다가 뺐다 — 장르에서 낯설고 매 턴 뜨면 과하다 (사용자 결정 2026-11-06)
// 기록은 전투마다 새로 (중단 저장에는 넣지 않는다 — 이어 하면 그 뒤부터)
import { mapRect } from './screen'
import { S } from './state'
import { esc, openWin, closeWin } from './ui'
import type { Unit } from './unit'

interface Mark { hp: Map<Unit, { hp: number; poison: number; coma: number }>; troop: number[]; on: Set<Unit> }
export interface LogEntry { turn: number; side: 'ally' | 'enemy'; html: string }

export const battleLog: LogEntry[] = []
export const resetLog = () => { battleLog.length = 0 }

/** 지금 전장을 찍어 둔다 */
export function mark(): Mark {
  const hp = new Map<Unit, { hp: number; poison: number; coma: number }>()
  for (const u of [...S.units, ...S.reserve]) hp.set(u, { hp: u.hp, poison: u.poison, coma: u.coma })
  return { hp, troop: [...S.troopState], on: new Set(S.units) }
}

const ally = (u: Unit) => u.side === 'ally'
const name = (u: Unit) => esc(u.type.name)
/** 이름 몇 개 + "외 N명" */
const names = (us: string[], max = 4) => us.length > max ? `${us.slice(0, max).join(', ')} 외 ${us.length - max}명` : us.join(', ')

/** 찍어 둔 뒤 바뀐 것을 한 줄 (HTML) 로. 아무 일 없으면 '' */
export function diff(m: Mark, side: 'ally' | 'enemy'): string {
  const hurt: string[] = [], fell: string[] = [], poisoned: string[] = [], comaed: string[] = []
  let foesDown = 0
  for (const [u, was] of m.hp) {
    if (was.hp <= 0 || u.absent) continue
    if (ally(u)) {
      if (u.hp <= 0) fell.push(name(u))
      else if (u.hp < was.hp) hurt.push(`${u.hp <= u.maxHp / 4 ? `<span class="red">${name(u)}</span>` : name(u)} −${was.hp - u.hp}`)
      if (u.hp > 0 && u.poison > 0 && was.poison <= 0) poisoned.push(name(u))
      if (u.hp > 0 && u.coma > 0 && was.coma <= 0) comaed.push(name(u))
    } else if (u.side === 'enemy' && u.hp <= 0) foesDown++
  }
  const foes = (us: Unit[]) => us.filter(u => u.side === 'enemy' && u.hp > 0).length
  // 경계·대기 (1·2) 에서 움직이기 시작한 적 부대, 숨김 (4) 에서 맵에 나온 적 (증원)
  const woke = foes(S.units.filter(u => m.on.has(u) && S.troopState[u.troop] === 0 && (m.troop[u.troop] === 1 || m.troop[u.troop] === 2)))
  const came = foes(S.units.filter(u => !m.on.has(u)))
  const parts = [
    ...hurt.length ? [`${side === 'ally' ? '반격 맞음' : '맞음'} ${names(hurt)}`] : [],
    ...fell.length ? [`<span class="red">쓰러짐 ${names(fell)}</span>`] : [],
    ...poisoned.length ? [`중독 ${names(poisoned)}`] : [],
    ...comaed.length ? [`혼수 ${names(comaed)}`] : [],
    ...foesDown ? [`적 ${foesDown}명 쓰러뜨림`] : [],
    ...woke ? [`<span class="blue">적 ${woke}명 깨어남</span>`] : [],
    ...came ? [`<span class="red">적 증원 ${came}명</span>`] : [],
  ]
  return parts.join(' · ')
}

/** 기록에 한 줄 (아무 일 없으면 "피해 없음" / "변화 없음") */
export function record(turn: number, side: 'ally' | 'enemy', html: string) {
  battleLog.push({ turn, side, html: html || '<span class="dim">' + (side === 'enemy' ? '피해 없음' : '변화 없음') + '</span>' })
}

// ---------- 전투 기록 창 (메뉴) ----------

/** 턴마다 아군·적 차례 한 줄씩, 최근 것이 위 */
export function logWin() {
  const rows = [...battleLog].reverse().map(e =>
    `<div><span class="${e.side === 'enemy' ? 'red' : 'blue'}">${e.turn}턴 ${e.side === 'enemy' ? '적' : '아군'}</span> ${e.html}</div>`)
  const body = `<div class="rules battlelog">${rows.join('') || '<div class="dim">기록 없음</div>'}</div>`
  const width = Math.min(mapRect().w - 16, 520)
  const open = (bodyH?: number) => openWin({ title: '전투 기록', kind: 'log', at: 'center', width, dir: 'row', bodyH,
    body, buttons: [['닫기', () => {}]], onBack: () => closeWin('log'), x: false })
  // 창 높이는 글자 수 어림이라 → 그려 본 높이로 다시 연다 (넘치면 맵 높이까지, 나머지는 스크롤)
  const b = open().querySelector<HTMLElement>('.b')!
  if (b.scrollHeight !== b.clientHeight) open(Math.min(b.scrollHeight, mapRect().h - 100))
}
