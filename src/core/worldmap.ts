// 장 사이 대륙 지도 (원작 0aa2:2120, formats.md "대륙 지도"): 「亞摩斯大陸」 지도(ECLIPSE.SCR 43) 위에 그 장의 장소 이름표(SCR 장−1)를
// 원작 좌표표 자리에 그려 잠깐 보여 준다. 두 판 공통 (사용자 결정 2026-10-14). 장 지도 화면(replayScreens)도 같은 자원을 쓴다
import { A } from './data'
import { fadeIn, fadeOut } from './fade'

export interface Place { name: string; x: number; y: number; w: number; h: number; sy: number }

let places: Promise<Place[]> | null = null
/** 장마다 장소 (칸 n = n+1장). 원작 43장만 */
export const loadPlaces = () => places ??= fetch(`${A}/data/worldmap.json`).then(r => r.json()).then(j => j.places as Place[])

/** 이름표 한 장 (places.png 시트의 칸) */
export function placeLabel(p: Place, cls = 'place') {
  const e = document.createElement('i')
  e.className = cls
  Object.assign(e.style, { left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.h}px`,
    backgroundImage: `url(${A}/ui/places.png)`, backgroundPosition: `0 -${p.sy}px` })
  e.title = p.name
  return e
}

const HOLD_MS = 2000

/** 화면이 어두운 상태에서 불러 지도를 밝혔다가 다시 어둡게 한다. 클릭·키로 넘긴다 */
export async function travelMap(n: number) {
  const p = (await loadPlaces().catch(() => []))[n - 1]
  if (!p) return
  const root = document.createElement('div')
  root.id = 'worldmap'
  root.innerHTML = `<div class="stage"><img class="map" src="${A}/ui/worldmap.png" alt="아모스 대륙 지도"></div>`
  const stage = root.querySelector<HTMLElement>('.stage')!
  stage.append(placeLabel(p))
  const fit = () => stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / 640, innerHeight / 480)})`
  fit()
  addEventListener('resize', fit)
  document.body.append(root)
  await root.querySelector<HTMLImageElement>('img')!.decode().catch(() => {})
  await fadeIn()
  await new Promise<void>(ok => {
    const done = () => { clearTimeout(t); root.removeEventListener('pointerdown', done); removeEventListener('keydown', done, true); ok() }
    const t = setTimeout(done, HOLD_MS)
    root.addEventListener('pointerdown', done)
    addEventListener('keydown', done, true)
  })
  await fadeOut()
  removeEventListener('resize', fit)
  root.remove()
}
