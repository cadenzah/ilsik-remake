// 원작에서 추출한 자원 로딩 (public/assets, tools/export_web.py 가 생성)

export interface UnitType {
  id: number; name: string; por: number; cls: number
  lv: number; hp: number; mp: number; atk: number; def: number; mov: number
}

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

export const loadUnitTypes = () => json<UnitType[]>(`${A}/data/units.json`)
export const loadDialogue = () => json<string[]>(`${A}/data/dialogue.json`)

export async function loadStage(n: number) {
  const id = String(n).padStart(2, '0')
  const [map, atlas] = await Promise.all([json<StageMap>(`${A}/stages/${id}.json`), loadImage(`${A}/stages/${id}.png`)])
  return { map, atlas }
}

export const unitSpriteUrl = (type: number) => `${A}/units/${String(type).padStart(3, '0')}.png`
export const portraitUrl = (por: number) => `${A}/portraits/${String(por).padStart(3, '0')}.png`
export const loadUnitSprite = (type: number) => loadImage(unitSpriteUrl(type))
