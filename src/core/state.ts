// 전투 상태 — 엔진 모듈들이 함께 읽고 쓴다
import type { CondRule, Fig, Magic, Member, Scenes, StageMap, Tables, TurnEvent, UnitType } from './data'
import type { Edition } from './edition'
import type { Moves } from './grid'
import type { Placement, StageDef } from './stage'
import type { Pos, Side, Unit } from './unit'

export type Mode =
  | { kind: 'busy' }
  | { kind: 'idle' }
  | { kind: 'selected'; unit: Unit; moves: Moves }
  | { kind: 'moved'; unit: Unit; from: Pos }
  | { kind: 'targeting'; unit: Unit; from: Pos; magic?: Magic }   // magic = 마법 중심 칸 고르기

export const S = {
  ed: null as unknown as Edition,
  def: null as unknown as StageDef,
  allies: [] as Placement[],
  enemies: [] as Placement[],
  troopInit: [] as number[],   // 부대별 초기 상태 (+0x235)
  troopState: [] as number[],
  routeTable: [] as number[][],  // 전투 순서표 route[i][루트] = i번째 전투의 장 번호
  cond: [] as CondRule[],
  turnEv: [] as TurnEvent[],
  fired: new Set<number>(),    // 이미 발동한 규칙 번호
  reserve: [] as Unit[],       // 상태 4 (숨김) 부대 대원. 상태가 바뀌면 맵에 나온다
  deploy: [] as number[],      // 출전 대원 = 일행(PARTY) 인덱스, 순서 = 출전 칸 순서
  joined: [] as number[],      // 이번 전투 중 합류한 유닛 종류 (38장 소피아). 승리하면 일행에 넣는다
  reward: [] as number[],      // 클리어 보상 도구 (BAD, 추정)
  map: null as unknown as StageMap,
  atlas: null as unknown as HTMLImageElement,
  types: [] as UnitType[],
  tables: null as unknown as Tables,
  dialogue: [] as string[],
  scenes: null as unknown as Scenes,
  sprites: new Map<number, HTMLImageElement>(),
  figs: new Map<number, Fig>(),   // 공격·시전 동작 (ECPnn.FIG)
  units: [] as Unit[],
  turn: 1,
  active: [] as Unit[],        // 지금 행동 단계에서 플레이어가 움직일 수 있는 일행 대원
  mode: { kind: 'busy' } as Mode,
  hover: null as Pos | null,
  threat: false,
  watch: null as Unit | null,  // 개선판: 클릭한 적 하나의 위협 범위
  aim: null as Pos | null,     // 공격 확인창이 떠 있는 동안 대상 칸 (STA 2 틀)
  marks: true,                 // 진영 표시 (원작 시스템 → 표기)
  notice: false,               // 원작 시스템 → 알림: 공격·마법 확인창 (기본 닫기, 저장 안 됨 — formats.md "시스템 창 설정")
  cam: { x: 0, y: 0, scale: 1 },
  // 마법 연출: 원작 ECLIPSE.MAG 프레임 (base = 마법 id×6) 을 칸마다 ring 박자 늦게 6장, 밑에 계열 색 칠하기
  fx: null as { cells: (Pos & { ring: number })[]; base: number; step: number; color: string; t0: number; until: number } | null,
  floats: [] as { x: number; y: number; text: string; t0: number; color: string }[],
}

export const unitAt = (x: number, y: number) => S.units.find(u => u.hp > 0 && u.x === x && u.y === y)
export const alive = (side: Side) => S.units.filter(u => u.hp > 0 && u.side === side)
// 플레이어가 조종하는 건 일행(부대 0)뿐. NPC 부대는 같은 편이지만 컴퓨터가 움직인다 (원작 +0x237: 일행 0, NPC 1, 적 2 → 2ff8:0ea0)
export const isNpc = (u: Unit) => u.side === 'ally' && u.troop !== 0
export const canCommand = (u: Unit) => S.active.includes(u) && u.hp > 0 && !u.acted
// 원작 부대·대원 번호로 유닛 (숨은 부대 대원 포함)
export const member = ([t, m]: Member) => [...S.units, ...S.reserve].find(u => u.troop === t && u.member === m)
