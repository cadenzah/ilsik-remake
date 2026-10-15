// 원작판 전투 규칙 [확정] — 행동 실행 20ec:6e92, 수치 함수 0aa2:0e17(유닛, x, k) (rules.md "원작 전투 공식").
// 전투 계산에 난수가 없다: 명중 판정·치명타·피해 흔들림·반격 모두 없음. 정수화는 0 쪽 절사, 중간값 일부는 float32
import type { Item, Magic, StageMap, Tables, UnitType } from '../../core/data'
import type { LevelUp, Rules, SpellHit } from '../../core/edition'
import { applyMods, equippedStats, type BuffStat, type Pos, type Unit } from '../../core/unit'

const f32 = Math.fround
const tr = Math.trunc
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** 피로 배율 F(f) = (1.5 − 0.01(101−f))(1.6 − 0.01(101−f)). 피로 0 → 0.2499, 피로가 쌓일수록 커져 공격·방어력이 떨어진다 */
const F = (f: number) => (1.5 - (101 - f) * 0.01) * (1.6 - (101 - f) * 0.01)
/** k1 물리 공격력 / k2 물리 방어력 (능력치는 현재값) */
export const k1 = (u: Unit) => tr(f32(0.7 * u.atk + 0.3 * u.agi) * f32((2.6 - F(u.fatigue)) * 100))
export const k2 = (u: Unit) => tr(f32(0.7 * u.def + 0.3 * u.agi) * f32((2.4 - F(u.fatigue)) * 100))

/** 지형 보정 (6e92:77a5·7a05): LML 레이어3 3 이 100%. 이동방식 3(물)·4(비행) 은 고정. 물리 공격에만 */
const layer3 = (map: StageMap, p: Pos) => map.layer3[p.y * map.w + p.x] ?? 3
const flier = (u: Unit) => u.type.moveKind === 3 || u.type.moveKind === 4
const terrAtk = (map: StageMap, u: Unit, at: Pos) => flier(u) ? 106 : 94 + 2 * layer3(map, at)
const terrDef = (map: StageMap, u: Unit) => flier(u) ? 115 : 85 + 5 * layer3(map, u)

/** 물리 피해 (6e92:7932): trunc((A·0.01·Ta − D·0.01·Td)·0.01) 를 [1, 99], 대상 HP 까지 */
function damage(map: StageMap, a: Unit, d: Unit, at: Pos = a) {
  const v = tr((k1(a) * 0.01 * terrAtk(map, a, at) - k2(d) * 0.01 * terrDef(map, d)) * 0.01)
  return Math.min(clamp(v, 1, 99), d.hp)
}

/** k3 마법 공격력 / k4 마법 방어력 */
export const k3 = (u: Unit) => tr(f32(0.6 * u.atk + 0.4 * u.spi) * f32((2.6 - F(u.fatigue)) * 100))
export const k4 = (u: Unit) => tr(f32(0.7 * u.spi + 0.3 * u.def) * f32((2.4 - F(u.fatigue)) * 100))
/** k5 회복량 / k6 강화·약화 세기 (시전자, x = 위력) / k7 강화 저항 / k8 약화 저항 (대상, 정신 최대치) */
const k5 = (u: Unit, x: number) => tr((1 + 0.05 * (0.8 * u.atk + 0.2 * u.spi)) * x * 0.333)
const k6 = (u: Unit, x: number) => tr(((u.spi + 100) * 0.0025 + 0.25 * x) * 4.2)
const k7 = (u: Unit) => tr((3 - F(u.fatigue) + (u.base.spi + 100) * 0.005) * 2.5)
const k8 = (u: Unit) => tr((5 - 1.5 * (1.5 - 0.01 * u.fatigue) * (1.6 - 0.01 * u.fatigue) + (u.base.spi + 100) * 0.005) * 3)
const ratio = (a: Unit, d: Unit) => k3(a) / Math.max(1, k4(d))

// 효과 번호 (MAD +0x12) → 강화·약화 능력치. 1~4 증가 / 8~11 감소: 역량·방어·민첩·정신
const BUFF: BuffStat[] = ['atk', 'def', 'agi', 'spi']
const IMMUNE = new Set([19, 20])   // 수호자: 중독·혼수 안 걸림

/** 혼수 성공 (124e:c1b6): (시전자 정신max·130 − 대상 정신max·(130 − 대상 피로)) div 시전자 정신max > 50.
 *  원작은 16비트 부호 없는 나눗셈이라 앞의 값이 음수면 (대상 정신이 훨씬 높으면) 성공한다 — fixBug 면 실패로 */
function comaHits(a: Unit, d: Unit, fixBug: boolean) {
  const n = a.base.spi * 130 - d.base.spi * (130 - d.fatigue)
  if (n < 0) return !fixBug
  return Math.floor(n / Math.max(1, a.base.spi)) > 50
}

/** 마법 한 대상 (124e:c1b6 효과 → 계산, 6e92 마법 분기). P = MAD 위력. 지형 보정 없음 */
function spell(a: Unit, d: Unit, m: Magic, fixBug: boolean): SpellHit {
  const P = m.power, e = m.effect
  if (e === 7) return { kind: 'hp', value: Math.min(clamp(tr(0.00075 * P * P * ratio(a, d)), 1, 99), d.hp) }
  if (e === 0) {
    const v = clamp(k5(a, P), 1, 99)
    return { kind: 'heal', value: Math.min(v, d.maxHp - d.hp), fatigue: Math.min(d.fatigue, tr(1 + 0.33 * v)) }
  }
  if (e >= 1 && e <= 4) return { kind: 'stat', stat: BUFF[e - 1], value: clamp(k6(a, P) - k7(d), 1, 99) }
  if (e >= 8 && e <= 11) return { kind: 'stat', stat: BUFF[e - 8], value: -clamp(k6(a, P) - k8(d), 1, 99) }
  if (e === 15) return { kind: 'tire', value: Math.min(clamp(tr((0.1 * P) ** 4 * 0.00125 * ratio(a, d) * 0.1), 1, 99), 100 - d.fatigue) }
  if (e === 12 || e === 13) {
    if (IMMUNE.has(d.type.id) || (e === 13 && !comaHits(a, d, fixBug))) return { kind: 'miss' }
    return { kind: e === 12 ? 'poison' : 'coma' }
  }
  return { kind: 'cure', what: e === 5 ? 'poison' : e === 6 ? 'coma' : 'all' }
}

/** 경험치 (20ec:9b1d~9fa8, 일행만). 대상마다 g = 1 + 0.25(대상 레벨 − 행동자 레벨), 쓰러뜨렸으면 trunc(32g), 아니면 trunc(g·값) 을 더해 [1, 64].
 *  마법은 내부 효과로 덮어쓴다: 회복 = 회복량 합, 해독·혼수해제·상태회복 = 풀린 대상 ×10, 중독·혼수 = 대상 수 ×10, 피로증가 ×7,
 *  강화·약화 ×5, 생명상해 = 위 식. 다시 [1, 64] */
function expGain(a: Unit, hits: { target: Unit; value: number }[], m?: Magic, cured = 0) {
  let sum = 0
  for (const { target: t, value } of hits) {
    const g = 1 + 0.25 * (t.type.lv - a.type.lv)
    sum += t.hp <= 0 ? tr(32 * g) : tr(g * value)
  }
  sum = clamp(sum, 1, 64)
  if (m) {
    const e = m.effect, n = hits.length
    if (e === 0) sum = hits.reduce((s, h) => s + h.value, 0)
    else if (e === 5 || e === 6 || e === 14) sum = cured * 10
    else if (e === 12 || e === 13) sum = n * 10
    else if (e === 15) sum = n * 7
    else if (e !== 7) sum = n * 5
  }
  return clamp(sum, 1, 64)
}

/** 레벨업 0aa2:1afd (레벨은 부르기 전에 +1). 표는 data/growth.json (EXE DS).
 *  1) 능력치: 생명·역량·방어·정신·민첩 마다 최대치 (장비 포함) 가 상한 stat[초상] 미만이면 random(n) + 보너스 를 최대치·현재치에 (생명은 최대치만).
 *     기본 n = 2, 보너스 (2,0,0,0,1). 성장 문자 letters[id×8 + (레벨−1) div 5] 가 바꾼다. 상한에 걸려도 난수는 뽑는다
 *  2) 레벨이 weapon[id] 의 배수면 무기 Item id +1, armor[id] 의 배수면 방어구 +1 (cap[세부] 미만일 때). 장비 해제 → 승급 → 다시 장착 (현재치 채우기 없음)
 *  3) 레벨이 magic[id] 의 배수이고 마법 < 8 이면 마지막 마법 id + 1. 레이몬 (초상 16) 만 raymond[루트][마법 수], 마법 7개면 배우지 않음
 *  4) 피로 0 */
function levelUp(u: Unit, tables: Tables, route: number, range: (t: UnitType, items: Map<number, Item>) => [number, number]): LevelUp {
  const t = u.type, G = tables.growth
  let n = 2
  const bonus = [2, 0, 0, 0, 1]
  // 8글자를 넘는 레벨 (41~) 은 원작처럼 다음 인물 줄을 읽는다
  switch (G.letters.join('')[t.id * 8 + Math.floor((t.lv - 1) / 5)]) {
    case 'a': bonus[1] = 1; break
    case 'b': bonus[2] = 1; break
    case 'c': bonus[3] = 1; break
    case 'd': bonus[4] = 2; break
    case 'e': bonus[0] = 1; break
    case 'f': bonus[0] = 1; n = 3; break
    case 'g': bonus.splice(0, 5, 2, 2, 2, 1, 1); break
  }
  const cap = G.stat[t.por] ?? [], keys = ['atk', 'def', 'spi', 'agi'] as const
  const cur = [u.maxHp, ...keys.map(k => u.base[k])]
  const gains = cur.map((v, i) => {
    const r = Math.floor(Math.random() * n)
    return v < (cap[i] ?? Infinity) ? r + bonus[i] : 0   // 표 밖 인물 (일행이 아닌 종류) 은 상한 없음 [근사: 원작은 표 너머를 읽음]
  }) as LevelUp['gains']
  u.maxHp += gains[0]; t.hp += gains[0]
  keys.forEach((k, i) => { u.base[k] += gains[i + 1]; t[k] += gains[i + 1] })
  const out: LevelUp = { gains }
  // 장비 승급. 원작은 세부만 남은 빈 칸 (id 0) 도 올려 id 1 이 되지만 웹은 빈 칸을 건너뛴다 [근사]
  const W = G.weapon[t.id] ?? 100, Ar = G.armor[t.id] ?? 100
  if (t.lv % W === 0 || t.lv % Ar === 0) {
    const before = equippedStats(t, tables.items)
    const up = (slot: 0 | 1, every: number) => {
      const it = tables.items.get(t.equip[slot])
      if (!it || t.lv % every || it.id >= (G.cap[it.sub] ?? 0)) return undefined
      t.equip[slot] = it.id + 1
      return it.id + 1
    }
    out.weapon = up(0, W)
    out.armor = up(1, Ar)
    const after = equippedStats(t, tables.items)
    u.maxHp += after.maxHp - before.maxHp
    u.hp = Math.max(1, u.hp + after.maxHp - before.maxHp)
    keys.forEach(k => { u.base[k] += after[k] - before[k] })
    u.mov += after.mov - before.mov
    u.range = range(t, tables.items)
  }
  applyMods(u)
  const M = G.magic[t.id] ?? 100
  if (t.lv % M === 0 && t.magic.length < 8 && !(t.por === 16 && t.magic.length === 7)) {
    const id = t.por === 16 ? G.raymond[route]?.[t.magic.length] : (t.magic.at(-1) ?? 0) + 1
    if (id !== undefined) { t.magic.push(id); out.magic = id }
  }
  u.fatigue = 0
  return out
}

/** 판 규칙. fixComaBug = 혼수 판정 원작 버그 고침 (개선판) */
export function makeRules(fixComaBug = false): Rules { return {
  damageRange(map, a, d, at) {
    const v = damage(map, a, d, at)
    return [v, v]
  },
  rollDamage: (map, a, d) => damage(map, a, d),
  // 무기 EAD f2 = 사거리, f3 = 범위 (0aa2:17dd → +0x44/+0x46, 무기 없으면 1/0). 사거리 범람 모양은 [추정] 마름모.
  // 사거리 칸은 자기 칸을 포함하고 (f2 = 0 이면 자기 칸만, 20ec:d9b0) 자기 칸은 같은 편 표시라 상대를 노리는 공격에선 빠진다 → 최소 1.
  // 기사 (직업 15, 공격 유형 2) 는 같은 편을 중심으로 고르므로 자기 칸부터 (core/attack.ts). 그 밖의 f2 = 0 (지팡이·부적 등) 은 [근사] 1
  weaponRange(t, items) {
    const f2 = items.get(t.equip[0])?.f2 ?? 1
    return t.job === 15 ? [0, f2] : [1, Math.max(1, f2)]
  },
  // 휴식 20ec:038e: HP += int(최대HP × 0.1 + 2), 피로 −= min(30, 피로)
  restHeal: u => Math.trunc(u.maxHp * 0.1 + 2),
  restFatigue: u => Math.max(0, u.fatigue - 30),
  /** 행동 뒤 피로. 물리 공격 (8f16): += trunc((6·부하 + 82)·(1 + 0.1·(경로길이 + 5))·0.033), 경로길이 = 움직인 칸 + 1.
   *  이어서 이동 (a317): += 움직인 칸. 단계마다 상한 100. 맞아도 늘지 않는다 */
  fatigueAfter(u, attacked, magic) {
    let f = u.fatigue
    if (attacked) f = Math.min(100, tr(f + (6 * u.type.rank + 82) * (1 + 0.1 * (u.steps + 1 + 5)) * 0.033))
    // 마법 (8e0f): += trunc((6·부하 + 82)·MAD 피로·0.01)
    if (magic) f = Math.min(100, tr(f + (6 * u.type.rank + 82) * magic.fatigue * 0.01))
    return Math.min(100, f + u.steps)
  },
  // 시전 조건 피로 + MAD 피로 ≤ 90 (124e:3481)
  canCast: (u, m) => u.fatigue + m.fatigue <= 90,
  // MAD 사거리 = 중심 칸 거리, 0 = 자기 자리 (노래). 범위 = 중심에서 마름모 반경 [추정: 범람 35ae:1253 모양]. 자기 편 마법은 자기 자신도
  spellRange: m => m.range === 0 ? [0, 0] : [isFoeSpell(m) ? 1 : 0, m.range],
  spellSide: m => isFoeSpell(m) ? 'foe' : 'own',
  spell: (a, d, m) => spell(a, d, m, fixComaBug),
  // 매 차례 (20ec:a419): 중독 → 1 줄고 HP −= max(1, trunc(HP·0.33)) / 혼수 → 1 줄고 휴식하고 넘김 /
  // 강화·약화 남은량 r → d = min(r, 1 + floor(10r/(현재 정신 + 50))) 만큼 원상 쪽으로
  statusTick(u) {
    let poison = 0
    if (u.poison > 0) { u.poison--; poison = Math.min(u.hp, Math.max(1, tr(u.hp * 0.33))); u.hp -= poison }
    const coma = u.coma > 0
    if (coma) u.coma--
    const spi = u.spi
    for (const k of BUFF) {
      const r = Math.abs(u.mods[k])
      if (r) u.mods[k] -= Math.sign(u.mods[k]) * Math.min(r, 1 + Math.floor((10 * r) / (spi + 50)))
    }
    applyMods(u)
    return { poison, coma }
  },
  expGain,
  levelUp(u, tables, route) { return levelUp(u, tables, route, this.weaponRange) },
} }

/** 효과 7~13·15 = 상대편 (124e:c1b6 대상편) */
export const isFoeSpell = (m: Magic) => (m.effect >= 7 && m.effect <= 13) || m.effect === 15

export const rules = makeRules()

/** 행동 순서 키 [확정] 0aa2:0e17(유닛, 0) = int(100 × (1.1 − 0.01×피로) × (1.2 − 0.01×피로) × (0.3×HP% + 0.7×민첩)).
 *  HP% = HP×100 div 최대HP (정수), 최대HP 0 이면 0 */
export function orderKey(u: Unit): number {
  if (!u.maxHp) return 0
  const hpPct = Math.floor((u.hp * 100) / u.maxHp)
  return Math.floor(100 * (1.1 - 0.01 * u.fatigue) * (1.2 - 0.01 * u.fatigue) * (0.3 * hpPct + 0.7 * u.agi))
}

/** 원작 124e:26b7: 라운드마다 모든 부대·대원을 순서 키 내림차순으로 한 명씩. 같으면 부대·대원 순 (0aa2:0327 버블 정렬) */
export function order(units: Unit[]): Unit[][] {
  return units.map(u => ({ u, k: orderKey(u) }))
    .sort((a, b) => b.k - a.k || a.u.troop - b.u.troop || a.u.member - b.u.member)
    .map(({ u }) => [u])
}
