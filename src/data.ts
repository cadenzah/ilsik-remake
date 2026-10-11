// 원작에서 추출한 자원 로딩 (public/assets, tools/export_web.py 가 생성)

export interface UnitType {
  id: number; name: string; por: number; cls: number
  lv: number; hp: number; mp: number; atk: number; def: number; mov: number
  equip: [number, number, number]   // 무기·방어구·도구 Item id, 0 = 없음
  canMagic: number; magic: number[] // Magic id
}

/** ECLIPSE.EAD. cat 0 무기 / 1 방어구 / 2 도구. stat·stat2 = [능력치 번호, 보정량] (formats.md) */
export interface Item {
  id: number; cat: number; sub: number; name: string
  f1: number; f2: number; f3: number
  stat: [number, number]; stat2: [number, number]
}

/** ECLIPSE.MAD. effect 7 = 공격, 0 = 회복 (formats.md) */
export interface Magic {
  id: number; school: number; name: string
  range: number; area: number; effect: number; power: number; mp: number
}

/** 게임 데이터 표. items·magic 은 id 로 바로 찾도록 Map */
export interface Tables { types: UnitType[]; items: Map<number, Item>; magic: Map<number, Magic> }

export interface StageMap {
  w: number; h: number; atlasCols: number
  tiles: number[]; layer2: number[]; layer3: number[]
}

export const TW = 56
export const TH = 48

const A = '/assets'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const im = new Image()
    im.onload = () => ok(im)
    im.onerror = () => fail(new Error(`이미지 로드 실패: ${src}`))
    im.src = src
  })
}

async function json<T>(src: string): Promise<T> {
  const r = await fetch(src)
  if (!r.ok) throw new Error(`로드 실패: ${src}`)
  return r.json()
}

export async function loadTables(): Promise<Tables> {
  const [types, items, magic] = await Promise.all([
    json<UnitType[]>(`${A}/data/units.json`), json<Item[]>(`${A}/data/items.json`), json<Magic[]>(`${A}/data/magic.json`),
  ])
  return { types, items: new Map(items.map(i => [i.id, i])), magic: new Map(magic.map(m => [m.id, m])) }
}
export const loadDialogue = () => json<string[]>(`${A}/data/dialogue.json`)

/** ECLIPSE.BAD 배치 (tools/bad.py). at = [x, y] 칸 */
export interface BattleUnit { type: number; at: [number, number] }
export interface BattleRecord {
  slots: [number, number][]                 // 주인공 일행 출전 칸 (최대 8)
  npc: BattleUnit[]                          // 함께 싸우는 동료·NPC
  groups: { active: number; units: BattleUnit[] }[]  // 적 무리, active 0 = 처음엔 대기 (추정)
  treasure: { item: number; at: [number, number] }[] // 숨은 보물 (추정)
  reward: number[]                           // 클리어 보상 도구 (추정)
}
export interface Battles { route: number[][]; records: Record<string, BattleRecord> }
export const loadBattles = () => json<Battles>(`${A}/data/battles.json`)

export async function loadStage(n: number) {
  const id = String(n).padStart(2, '0')
  const [map, atlas] = await Promise.all([json<StageMap>(`${A}/stages/${id}.json`), loadImage(`${A}/stages/${id}.png`)])
  return { map, atlas }
}

export const unitSpriteUrl = (type: number) => `${A}/units/${String(type).padStart(3, '0')}.png`
export const portraitUrl = (por: number) => `${A}/portraits/${String(por).padStart(3, '0')}.png`
export const loadUnitSprite = (type: number) => loadImage(unitSpriteUrl(type))
