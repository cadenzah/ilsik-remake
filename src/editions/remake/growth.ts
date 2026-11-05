// 개선판 성장 보탬 (B1 제안 5·N2, balance-proposal.md "5 + N2"). 원작판은 원작대로 (출전한 대원만 경험치, 합류는 PAD 레벨, 전직·교체는 새 종류 PAD 값부터)
// - 대기 동료 경험치: 이긴 장에서 출전 대원이 얻은 경험치 평균의 50% 를 출전하지 않은 일행 대원에게
// - 늦은 합류 맞춤: 합류 레벨이 출전 평균 − 2 보다 낮으면 거기까지 원작 성장식으로 레벨업
// - 성장 이어받기: 같은 인물이 새 종류가 되면 (애슬 → SM여왕, 수호자·아티스 2차, 아리크스 2차, 떠났다 돌아온 페니 2차)
//   전 종류 레벨이 새 종류 기본 레벨보다 높으면 그 차이만큼 새 종류 성장식으로 레벨업 (Q10), 경험치 끝수는 넘긴다
// - 쓰러진 대가 (제안 12, Q3): 이긴 장에서 쓰러진 출전 대원은 그 장 성장을 잃고 (전투 중 오른 레벨 포함), 다음 장을 피로 30 으로 시작
import { EQUIP, FLAGS, GROWN, PARTY, keepGrowth, partyType, type Camp, type Note } from '../../core/campaign'
import { gained, growParty } from '../../core/battleCore'
import type { UnitType } from '../../core/data'
import { S } from '../../core/state'
import { josa } from 'es-hangul'

const BENCH = 0.5, CATCH_UP = 2, DOWN_FATIGUE = 30
const DOWN = 'down:'   // 판 플래그 down:이름 = 다음 장 피로 (이름이라 전직·교체를 건너도 이어진다)

/** 레벨을 to 까지 (낮으면 그대로), exp = 남길 경험치 */
function raise(t: number, to: number, exp?: number) {
  growParty(t, to - partyType(t).lv)
  if (exp !== undefined) { const g = partyType(t); keepGrowth({ ...g, exp }) }
}

/** 출전 대원 평균 레벨 (전투 뒤면 이 전투에 나간 대원, 아니면 일행에서 그 대원을 뺀 평균) */
function deployedLevel(except: number) {
  const out = S.units?.filter(u => u.troop === 0).map(u => u.type.lv) ?? []
  const lv = out.length ? out : PARTY.filter(t => t !== except).map(t => partyType(t).lv)
  return lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 0
}

/** 같은 인물의 다른 종류로 쌓은 성장 (떠났다가 다른 모습으로 돌아온 대원 — 17장 페니 → 20장 페니 2차) */
const pastSelf = (t: number) => [...GROWN.keys()].filter(k => k !== t && !PARTY.includes(k) && S.types[k]?.name === S.types[t]?.name)
  .map(k => partyType(k)).sort((a, b) => b.lv - a.lv)[0]

function inherit(to: number, old: UnitType, notes: Note[]) {
  const base = partyType(to).lv
  raise(to, old.lv, old.exp)
  if (old.lv > base) notes.push({ text: `${josa(S.types[to].name, '이/가')} 쌓은 성장을 이어받았다 (Lv ${partyType(to).lv}).` })
}

export function partyChange(e: { join: number } | { change: number; old: UnitType }, notes: Note[]) {
  if ('change' in e) { inherit(e.change, e.old, notes); return }
  const t = e.join, past = pastSelf(t)
  if (past) inherit(t, past, notes)
  const want = Math.floor(deployedLevel(t)) - CATCH_UP, was = partyType(t).lv
  if (want > was) {
    raise(t, want)
    notes.push({ text: `${josa(S.types[t].name, '은/는')} 일행에 맞춰 레벨을 올려 합류했다 (Lv ${partyType(t).lv}).` })
  }
}

/** 지난 장에 쓰러진 대원의 시작 피로. 출전을 쉬어도 그 장이 끝나면 풀린다 */
export const startFatigue = (t: UnitType) => FLAGS.has(DOWN + t.name) ? DOWN_FATIGUE : undefined

/** 쓰러진 대가: 쓰러진 출전 대원 (자리 비움 제외) 을 장 시작 성장·장비로 되돌리고 다음 장 피로 플래그. 고정 일행인 숨은 장·마지막 장은 다음이 없어 뺀다 */
function fallenCost(notes: Note[], start: Camp) {
  if (S.ed.extraBattles?.[S.def.n] || S.cond.some(c => c.do.includes('ending'))) return
  const down = S.units.filter(u => u.troop === 0 && u.hp <= 0 && !u.absent).map(u => u.type.id).filter(t => PARTY.includes(t))
  if (!down.length) return
  const lost: string[] = []
  for (const t of down) {
    const was = partyType(t).lv, grown = start.grown?.[t], equip = start.equip?.[t]
    if (grown) GROWN.set(t, { ...grown, magic: [...grown.magic] }); else GROWN.delete(t)
    if (equip) EQUIP.set(t, [...equip] as UnitType['equip']); else EQUIP.delete(t)
    const now = partyType(t).lv
    if (now < was) lost.push(`${S.types[t].name} Lv ${was} → ${now}`)
    FLAGS.add(DOWN + S.types[t].name)
  }
  const names = down.map(t => S.types[t].name).join(', ')
  notes.push({ text: `${josa(names, '은/는')} 쓰러져 이 장의 경험치를 잃었다${lost.length ? ` (${lost.join(', ')})` : ''}. 다음 장은 피로 ${DOWN_FATIGUE}으로 시작한다.` })
}

/** 이긴 장: 출전 대원이 얻은 경험치 평균의 절반을 대기 동료에게, 쓰러진 대원은 대가 (start = 이 장 시작 상태, 시뮬레이터의 "지고도 이어 감" 은 없음) */
export function afterWin(notes: Note[], start?: Camp) {
  for (const f of [...FLAGS]) if (f.startsWith(DOWN)) FLAGS.delete(f)   // 지난 장 대가는 이 장으로 끝
  benchShare(notes)
  if (start) fallenCost(notes, start)
}

function benchShare(notes: Note[]) {
  const out = S.units.filter(u => u.troop === 0)
  if (!out.length) return
  const share = Math.floor(out.reduce((a, u) => a + (gained.get(u) ?? 0), 0) / out.length * BENCH)
  const deployed = new Set(out.map(u => u.type.id))
  const bench = PARTY.filter(t => !deployed.has(t))
  if (!share || !bench.length) return
  const ups: string[] = []
  for (const t of bench) {
    const g = partyType(t), exp = g.exp + share, levels = Math.floor(exp / 100)
    raise(t, g.lv + levels, exp % 100)
    if (levels) ups.push(`${S.types[t].name} Lv ${partyType(t).lv}`)
  }
  notes.push({ text: `대기 동료가 경험치를 받았다 (+${share}).${ups.length ? ` 레벨 업: ${ups.join(', ')}` : ''}` })
}
