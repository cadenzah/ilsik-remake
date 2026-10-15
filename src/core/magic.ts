// 마법: 중심 칸·범위·대상·결과 반영 — 두 판 공통. 계산식·사거리는 판 규칙 (S.ed.rules, editions/original/rules.ts)
import { MAGIC_EFFECTS, type Magic } from './data'
import type { Rules, SpellHit } from './edition'
import { dist, inside } from './grid'
import { S } from './state'
import { applyMods, type BuffStat, type Pos, type Unit } from './unit'

/** 쓸 수 있는 마법 목록 (PAD +90 마법 사용 가능, +94~ MAD id) */
export const spellsOf = (u: Unit): Magic[] => u.type.canMagic ? u.type.magic.map(id => S.tables.magic.get(id)).filter((m): m is Magic => !!m) : []

/** AI 가 마법을 쓰는 직업 (공격 유형 +0x151 = 1, 124e:22ab: 직업 8~14 마법사·승려·심령술사·현자·음유시인·대제관·환수사) */
export const aiCaster = (u: Unit) => u.type.job >= 8 && u.type.job <= 14 && spellsOf(u).length > 0

export function inSpellRange(rules: Rules, m: Magic, from: Pos, c: Pos) {
  const [lo, hi] = rules.spellRange(m), d = dist(from, c)
  return d >= lo && d <= hi
}

/** 범위 칸: 중심에서 마름모 반경 m.area [추정] */
export function areaCells(m: Magic, c: Pos): Pos[] {
  const out: Pos[] = []
  for (let dy = -m.area; dy <= m.area; dy++)
    for (let dx = -m.area; dx <= m.area; dx++)
      if (Math.abs(dx) + Math.abs(dy) <= m.area && inside(S.map, c.x + dx, c.y + dy)) out.push({ x: c.x + dx, y: c.y + dy })
  return out
}

/** 마법이 듣는 유닛: 범위 안의 대상편. from = 시전자가 설 자리 (AI 가 미리 따질 때 시전자 자신의 자리) */
export function spellTargets(rules: Rules, caster: Unit, m: Magic, c: Pos, units: Unit[] = S.units, from: Pos = caster): Unit[] {
  const foe = rules.spellSide(m) === 'foe'
  return units.filter(u => u.hp > 0 && (foe ? u.side !== caster.side : u.side === caster.side) && dist(u === caster ? from : u, c) <= m.area)
}

/** from 자리에서 고를 수 있는 중심 칸 (범위에 대상이 하나라도 있는 칸) */
export function spellCenters(rules: Rules, caster: Unit, m: Magic, units: Unit[] = S.units, from: Pos = caster): Pos[] {
  const [, hi] = rules.spellRange(m), out: Pos[] = []
  for (let dy = -hi; dy <= hi; dy++)
    for (let dx = -hi; dx <= hi; dx++) {
      const c = { x: from.x + dx, y: from.y + dy }
      if (inside(S.map, c.x, c.y) && inSpellRange(rules, m, from, c) && spellTargets(rules, caster, m, c, units, from).length) out.push(c)
    }
  return out
}

const STAT_LABEL: Record<BuffStat, string> = { atk: '역량', def: '방어', spi: '정신', agi: '민첩' }

/** 결과를 유닛에 반영 */
export function applyHit(t: Unit, h: SpellHit) {
  switch (h.kind) {
    case 'hp': t.hp = Math.max(0, t.hp - h.value); t.coma = 0; break   // 내부 효과 7 에 맞으면 혼수가 풀린다 (20ec:9456)
    case 'heal': t.hp = Math.min(t.maxHp, t.hp + h.value); t.fatigue -= h.fatigue; break
    case 'stat': t.mods[h.stat] = h.value; applyMods(t); break      // 현재치 = 최대치 ± v (누적 안 됨)
    case 'tire': t.fatigue = Math.min(100, t.fatigue + h.value); break
    case 'poison': t.poison = 3; break
    case 'coma': t.coma = 3; break
    case 'cure': if (h.what !== 'coma') t.poison = 0; if (h.what !== 'poison') t.coma = 0; break
  }
}

/** 떠오르는 글자와 색 */
export function hitText(h: SpellHit, side: Unit['side']): { text: string; color: string } {
  switch (h.kind) {
    case 'hp': return { text: `-${h.value}`, color: side === 'ally' ? '#ff8080' : '#ffffff' }
    case 'heal': return { text: `+${h.value}`, color: '#7dff9a' }
    case 'stat': return { text: `${STAT_LABEL[h.stat]}${h.value > 0 ? '+' : ''}${h.value}`, color: h.value > 0 ? '#9ad8ff' : '#ffb070' }
    case 'tire': return { text: `피로+${h.value}`, color: '#ffb070' }
    case 'poison': return { text: '중독', color: '#d48cff' }
    case 'coma': return { text: '혼수', color: '#9ad8ff' }
    case 'miss': return { text: '실패', color: '#cccccc' }
    case 'cure': return { text: h.what === 'poison' ? '해독' : h.what === 'coma' ? '깨어남' : '회복', color: '#7dff9a' }
  }
}

/** 예측 줄 (개선판 확인창): "이름 −12 (남는 생명 30/42)" 식 */
export function hitLine(t: Unit, h: SpellHit): string {
  if (h.kind === 'hp') return `${t.type.name} 피해 ${h.value} (남는 생명 ${t.hp - h.value}/${t.maxHp})${h.value >= t.hp ? ' · 처치' : ''}`
  if (h.kind === 'heal') return `${t.type.name} 생명 +${h.value}${h.fatigue ? ` · 피로 −${h.fatigue}` : ''}`
  return `${t.type.name} ${hitText(h, t.side).text}`
}

/** 마법 설명 (개선판 목록): 효과 · 사거리 · 범위 · 피로 */
export function spellDesc(m: Magic) {
  return `${MAGIC_EFFECTS[m.effect] ?? '?'} · 사거리 ${m.range || '자기 주변'} · 범위 ${m.area ? `반경 ${m.area}` : '한 명'} · 피로 +${m.fatigue}`
}

/** 계열 색 (빛·어둠·바람·물·불·땅·소환·노래·기원) — 시전 연출 칸 칠하기 */
export const SCHOOL_COLOR = ['255,240,150', '170,90,230', '140,240,150', '120,200,255', '255,140,60', '200,160,90', '255,150,220', '160,210,255', '255,255,255']
