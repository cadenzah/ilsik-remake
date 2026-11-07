// 개선판 상성 (B1 제안 25 · 25-2, balance-proposal.md "25 종족 상성"·"25-2 맞붙음 늘리기"). 두 편 모두.
// 대상 유닛 종류 하나에 대해 계열 (Magic.school, 빛 0 어둠 1 바람 2 물 3 불 4 땅 5) 과 활 ('bow', 궁수·추전수의 물리 공격) 마다 배율을 낸다.
// 층 다섯 개를 곱하고 [0.5, 2] 로 자른다:
//   종족: 불사족·마족은 빛에 약하고 어둠에 강하다, 불사족은 불에도 조금 약하다, 마족은 불에 강하다, 용족은 물(얼음)에 약하고 불에 강하다,
//         해족은 바람(벼락)에 약하고 물에 강하다, 빙마녀 (리사) 는 불에 약하고 물에 강하다, 기계 (수호자) 는 바람에 약하다
//   비행 (이동방식 4): 활·바람에 약하고 땅에 강하다
//   시전자 속성: 생명상해 마법을 가진 유닛은 그중 가장 많은 계열에 강하고 그 상극에 약하다 (물↔불, 바람↔땅, 빛↔어둠)
//   중갑 (직업 기사 · 중장기사, 비행 제외): 땅에 약하다
// 생명상해 마법 (rules.ts spell) 과 활의 물리 피해 (rules.ts damage) 에만 든다. 원작판은 없음
import type { Magic, UnitType } from '../../core/data'
import { S } from '../../core/state'

export type AffKey = number | 'bow'
const RACE: Record<number, Record<number, number>> = {
  7: { 0: 1.5, 4: 1.25, 1: 0.5 },
  9: { 0: 1.5, 1: 0.5, 4: 0.5 },
  8: { 3: 1.5, 4: 0.5 },
  10: { 2: 1.5, 3: 0.5 },
  11: { 4: 1.5, 3: 0.5 },
  12: { 2: 1.5 },
}
const FLY: Partial<Record<AffKey, number>> = { bow: 1.5, 2: 1.5, 5: 0.5 }
const OPPOSE: Record<number, number> = { 3: 4, 4: 3, 2: 5, 5: 2, 0: 1, 1: 0 }
const OWN = 0.5, COUNTER = 1.5
const ARMOR: Partial<Record<AffKey, number>> = { 5: 1.5 }
const HEAVY_TYPES = [50]   // 중장기사 (직업은 전사)

/** 층 켜고 끄기·세기 (tools/sim 이 바꿔 본다). scale = 배율의 1 과의 차를 몇 배로 */
export const AFF = { race: true, fly: true, cast: true, armor: true, scale: 1 }

export const isFlyer = (t: UnitType) => t.moveKind === 4
export const isHeavy = (t: UnitType) => !isFlyer(t) && (t.job === 15 || HEAVY_TYPES.includes(t.id))
/** 궁수·추전수 = 활 (포수는 포라서 아님) */
export const isBow = (t: UnitType) => t.job === 17 || t.job === 18

/** 시전자 속성: 생명상해 마법 중 가장 많은 계열 (같으면 앞 번호). 없거나 상극이 없는 계열 (소환·노래·기원) 이면 −1 */
export function elementOf(t: UnitType, magic?: Map<number, Magic>): number {
  if (!magic) return -1
  const n: Record<number, number> = {}
  for (const id of t.magic ?? []) { const m = magic.get(id); if (m && m.effect === 7 && m.school in OPPOSE) n[m.school] = (n[m.school] ?? 0) + 1 }
  let best = -1
  for (const k of Object.keys(n).map(Number)) if (best < 0 || n[k] > n[best]) best = k
  return best
}

/** 대상 종류의 상성 줄: 배율 표와 붙은 까닭 (카드·도감 꼬리표). magic 이 없으면 S.tables 의 것 */
export function affinityRow(t: UnitType, magic = S.tables?.magic): { row: Partial<Record<AffKey, number>>; tags: string[] } {
  const row: Partial<Record<AffKey, number>> = {}, tags: string[] = []
  const mul = (src: Partial<Record<AffKey, number>>) => { for (const [k, v] of Object.entries(src) as [string, number][]) { const key: AffKey = k === 'bow' ? 'bow' : Number(k); row[key] = (row[key] ?? 1) * v } }
  if (AFF.race && RACE[t.race]) { mul(RACE[t.race]); tags.push('race') }
  if (AFF.fly && isFlyer(t)) { mul(FLY); tags.push('비행') }
  const e = AFF.cast ? elementOf(t, magic) : -1
  if (e >= 0) { mul({ [e]: OWN, [OPPOSE[e]]: COUNTER }); tags.push(`${SCHOOL[e]} 마법`) }
  if (AFF.armor && isHeavy(t)) { mul(ARMOR); tags.push('중갑') }
  for (const k of Object.keys(row) as AffKey[]) {
    const v = Math.min(2, Math.max(0.5, row[k]!))
    row[k] = 1 + (v - 1) * AFF.scale
    if (row[k] === 1) delete row[k]
  }
  return { row, tags }
}

/** 이 종류가 계열 (또는 활) 에서 받는 배율 */
export const affinity = (t: UnitType, key: AffKey) => affinityRow(t).row[key] ?? 1

const SCHOOL = ['빛', '어둠', '바람', '물', '불', '땅']
const KEY_NAME = (k: AffKey) => k === 'bow' ? '활' : SCHOOL[k] ?? ''

/** 카드·도감 글: 약점 (센 것부터) · 내성. 예 「약점 빛·불 · 내성 어둠」 */
export function affinityNote(t: UnitType, magic?: Map<number, Magic>): string {
  const ent = (Object.entries(affinityRow(t, magic).row) as [string, number][]).map(([k, v]) => [k === 'bow' ? 'bow' : Number(k), v] as [AffKey, number]).sort((a, b) => b[1] - a[1] || (a[0] === 'bow' ? -1 : b[0] === 'bow' ? 1 : 0))
  const weak = ent.filter(([, v]) => v > 1).map(([k]) => KEY_NAME(k)), strong = ent.filter(([, v]) => v < 1).map(([k]) => KEY_NAME(k))
  return [weak.length ? `약점 ${weak.join('·')}` : '', strong.length ? `내성 ${strong.join('·')}` : ''].filter(Boolean).join(' · ')
}

/** 카드 이름 줄 꼬리표: 종족 (상성이 있을 때)·비행·「불 마법」·중갑 */
export function affinityTags(t: UnitType, raceName: string, magic?: Map<number, Magic>): string {
  return affinityRow(t, magic).tags.map(x => x === 'race' ? raceName : x).filter(Boolean).join('·')
}

/** 시스템 대화 안내 (tips-proposal.md 9절): 이 종류에 붙은 상성 갈래 — 장 시작에 처음 보이는 갈래를 소개한다.
 *  종족 (undead 불사족 · demon 마족 · dragon 용족 · sea 해족 · ice 빙마녀 · machine 기계) · fly 비행 · caster 마법 쓰는 유닛 · heavy 중갑 · archer 활 (궁수·추전수 — 날 수 있는 일행에게 위험) */
const RACE_KIND: Record<number, string> = { 7: 'undead', 9: 'demon', 8: 'dragon', 10: 'sea', 11: 'ice', 12: 'machine' }
export function affinityKinds(t: UnitType, magic = S.tables?.magic): string[] {
  const k: string[] = []
  if (AFF.race && RACE_KIND[t.race]) k.push(RACE_KIND[t.race])
  if (AFF.fly && isFlyer(t)) k.push('fly')
  if (AFF.cast && elementOf(t, magic) >= 0) k.push('caster')
  if (AFF.armor && isHeavy(t)) k.push('heavy')
  if (isBow(t)) k.push('archer')
  return k
}
