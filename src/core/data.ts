// 원작에서 추출한 자원 로딩 (public/assets, tools/export_web.py 가 생성)

export interface UnitType {
  id: number; name: string; por: number; cls: number
  // PAD 기본 능력치 (장비 보정 전). atk 역량 · def 방어 · spi 정신 · agi 민첩 (formats.md)
  lv: number; hp: number; atk: number; def: number; spi: number; agi: number; mov: number
  equip: [number, number, number]   // 무기·방어구·도구 Item id, 0 = 없음
  canMagic: number; magic: number[] // Magic id
}

/** ECLIPSE.EAD. cat 0 무기 / 1 방어구 / 2 도구. stat·stat2 = [능력치 번호, 보정량], 번호는 STAT_NAMES (9~16 = 1~8 감소) */
export interface Item {
  id: number; cat: number; sub: number; name: string
  f1: number; f2: number; f3: number
  stat: [number, number]; stat2: [number, number]
}

/** 장비 능력치 번호 이름 (EXE DS:0x1194) */
export const STAT_NAMES = ['없음', '생명', '정신', '역량', '방어', '마법', '이동', '민첩', '체력']

/** ECLIPSE.MAD. effect = MAGIC_EFFECTS 번호. fatigue = 시전 시 피로 증가량 (피로+fatigue ≤ 90 이면 시전 가능, MP 없음) */
export interface Magic {
  id: number; school: number; name: string
  range: number; area: number; effect: number; power: number; fatigue: number
}

/** 마법 효과 번호 이름 (EXE DS:0x1266) */
export const MAGIC_EFFECTS = ['생명회복', '공격증가', '방어증가', '민첩증가', '정신증가', '해독', '혼수해제', '생명상해',
  '공격감소', '방어감소', '민첩감소', '정신감소', '중독', '혼수', '상태회복', '피로증가']

/** 게임 데이터 표. items·magic 은 id 로 바로 찾도록 Map */
export interface Tables { types: UnitType[]; items: Map<number, Item>; magic: Map<number, Magic> }

export interface StageMap {
  w: number; h: number; atlasCols: number
  tiles: number[]; layer2: number[]; layer3: number[]
}

export const TW = 56
export const TH = 48

export const A = '/assets'

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
  npcState: number                           // NPC 부대 초기 상태 (4 = 숨김)
  groups: { active: number; units: BattleUnit[] }[]  // 적 무리, active = 부대 초기 상태 (0 행동, 1 경계, 2 대기, 3 고정, 4 숨김 — ai.ts)
  treasure: { item: number; at: [number, number] }[] // 숨은 보물 (추정)
  reward: number[]                           // 클리어 보상 도구 (추정)
}
/** 장별 승패 규칙 (tools/cond.py). 대원 = [부대, 번호], 부대 순서 = 0 일행, (npc 있으면) 1 npc, 이후 groups */
export type Member = [troop: number, member: number]
export type CondIf =
  | { dead: Member[] }               // 모두 HP 0
  | { reach: [number, number] }      // U[0.0] 이 그 칸에 도달
  | { hpBelow: [Member, number] }    // HP < 최대HP × 비율
  | { onlyLeft: Member }             // 남은 적이 그 대원뿐
export type CondDo = 'win' | 'lose' | 'ending' | { state: [number[], number] } | { scene: string } | { join: number } | { flag: string }
export interface CondRule { if: CondIf; do: CondDo[] }
/** 턴 시작 이벤트 (tools/cond.py TURN, 원작 124e:e0a5). turn·route·flag 가 맞으면 do 실행.
 *  area = [부대, 칸 목록]: 매 턴 일행 대원이 그 칸에 있으면 그 부대 상태 0 (37장 숨은 부대) */
export interface TurnEvent { turn?: number; route?: number; flag?: string; do?: CondDo[]; area?: [number, [number, number][]] }
export interface Battles {
  route: number[][]; records: Record<string, BattleRecord>; cond: Record<string, CondRule[]>; turn: Record<string, TurnEvent[]>
}
export const loadBattles = () => json<Battles>(`${A}/data/battles.json`)

/** 원작 대화 장면과 전투 전후 흐름 (tools/script.py, EXE 하드코딩에서 추출).
 *  장면 키 "phase:scene" — phase 0 전투 시작, 1 전투 중 트리거, 2 전투 후. scene = 스테이지 번호 또는 스테이지*10+k */
export type SceneLine = [who: number, line: number, branch: number]  // who -1 = 초상화 없음, branch 0 항상 / 1 선택 '예' / 2 '아니오'
// flag = 그 캠페인 플래그가 켜져야 실행, routes = 그 루트(0~2)에서만 (없으면 모든 루트), item/noItem = 그 도구를 가졌을 때/없을 때
// leave = 그 종류 대원 이탈, swap = [종류, 새 종류] 교체, promote = 그 종류 대원 직업 단계 +1 (if62 일 때, 미반영)
// take/give = 소지품 빼기/넣기, setFlag = alive 대원 [부대, 번호] 이 살아 있으면 그 플래그 켜기. 실행 = campaign.ts finishStage
export type PostStep = ({ join: number } | { count: number } | { set: [number, number] } | { scene: string }
  | { leave: number } | { swap: [number, number] } | { promote: number; if62: number }
  | { take: number } | { give: number } | { setFlag: string; alive: [number, number] }) & { routes?: number[]; flag?: string; item?: number; noItem?: number }
export interface Scenes {
  scenes: Record<string, SceneLine[]>
  pre: Record<string, string[]>        // 스테이지 → 전투 시작 장면들
  post: Record<string, PostStep[]>     // 스테이지 → 승리 후 합류·장면 (순서대로)
  trigger: string[]
  party: number[]                      // 초기 일행
  routeSelectAfter: number
}
export const loadScenes = () => json<Scenes>(`${A}/data/scenes.json`)

export async function loadStage(n: number) {
  const id = String(n).padStart(2, '0')
  const [map, atlas] = await Promise.all([json<StageMap>(`${A}/stages/${id}.json`), loadImage(`${A}/stages/${id}.png`)])
  return { map, atlas }
}

export const unitSpriteUrl = (type: number) => `${A}/units/${String(type).padStart(3, '0')}.png`
export const portraitUrl = (por: number) => `${A}/portraits/${String(por).padStart(3, '0')}.png`
export const loadUnitSprite = (type: number) => loadImage(unitSpriteUrl(type))
