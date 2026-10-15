// 판(에디션) 인터페이스. 엔진(core)은 공통이고, 규칙·행동 순서·AI·편의 기능은 판마다 다르다 (.claude/docs/editions.md)
import type { ScriptSource } from './script'
import type { ExtraBattle, Item, Magic, StageMap, UnitType } from './data'
import type { BuffStat, Pos, Unit } from './unit'

export interface Rules {
  /** 피해 범위 [최소, 최대]. at = 공격자가 칠 자리 (없으면 지금 자리, 지형 보정용) */
  damageRange(map: StageMap, a: Unit, d: Unit, at?: Pos): [number, number]
  rollDamage(map: StageMap, a: Unit, d: Unit): number
  /** 사거리 [최소, 최대] */
  weaponRange(t: UnitType, items: Map<number, Item>): [number, number]
  /** 휴식 회복량 (최대HP 를 넘지 않게는 엔진이 자른다) */
  restHeal(u: Unit): number
  /** 휴식 뒤 피로 */
  restFatigue(u: Unit): number
  /** 차례를 마칠 때 피로 (u.steps = 이번 차례에 움직인 칸, attacked = 공격했나, magic = 쓴 마법) */
  fatigueAfter(u: Unit, attacked: boolean, magic?: Magic): number
  /** 마법을 쓸 수 있나 (피로) */
  canCast(u: Unit, m: Magic): boolean
  /** 마법 중심 칸 거리 [최소, 최대] (시전자 자리에서) */
  spellRange(m: Magic): [number, number]
  /** 이 마법이 듣는 편: 'foe' = 시전자의 상대편, 'own' = 시전자 편 */
  spellSide(m: Magic): 'foe' | 'own'
  /** 대상 하나에 대한 마법 결과. 난수가 없으므로 예측과 실행이 같다 */
  spell(caster: Unit, target: Unit, m: Magic): SpellHit
  /** 차례 시작 처리 (중독 피해·혼수·강화 되돌림). 유닛을 바꾸고 일어난 일을 돌려준다 */
  statusTick(u: Unit): { poison: number; coma: boolean }
}

/** 마법 한 대상의 결과. hp = 피해, heal = 회복 (fatigue = 줄일 피로), stat = 강화·약화 (value 부호), tire = 피로 증가,
 *  poison·coma = 걸림 (3 차례), cure = 풀기 (what), miss = 듣지 않음 (혼수 실패·면역) */
export type SpellHit =
  | { kind: 'hp' | 'tire'; value: number }
  | { kind: 'heal'; value: number; fatigue: number }
  | { kind: 'stat'; stat: BuffStat; value: number }
  | { kind: 'poison' | 'coma' | 'miss' }
  | { kind: 'cure'; what: 'poison' | 'coma' | 'all' }

export interface AiPlan { unit: Unit; dest: Pos; target?: Unit; rest?: boolean; magic?: Magic; at?: Pos }   // rest = 제자리 휴식, magic = dest 에서 at 칸에 마법

export interface Edition {
  id: 'original' | 'remake'
  name: string
  rules: Rules
  /** 한 라운드의 행동 단계. 단계마다 일행(부대 0)이면 그 유닛들을 플레이어가, 아니면 AI 가 움직인다.
   *  숨김·사망 유닛도 넘겨받으며, 실행할 때 건너뛴다 */
  order(units: Unit[], round: number): Unit[][]
  /** 컴퓨터 조종 유닛의 행동. troopState 를 바꿀 수 있다 (경계 → 행동) */
  planFor(map: StageMap, units: Unit[], u: Unit, troopState: number[]): AiPlan
  /** 편의 기능: 적 위협 범위, 피해 예측, 적 클릭 한 번에 이동+공격.
   *  commandFirst = 유닛을 눌러 명령(이동/전투)을 먼저 고른다 (원작), 아니면 차례가 오면 이동 범위를 바로 보인다.
   *  autoRest = 이동·공격 없이 차례를 마치면 휴식, 아니면 휴식은 "휴식?" 확인으로만 (원작)
   *  originalCamp = 정비 화면을 원작 동작으로 (⟺ 로 편성 시작·선두만, 뒤까지 빼기, '여행계속' 확인 — 확인은 두 판 공통), 아니면 개선판 (앞에서부터 채워 둠). 정비 화면은 두 판 모두 전투마다 */
  features: { threat: boolean; forecast: boolean; quickAttack: boolean; commandFirst: boolean; autoRest: boolean; originalCamp: boolean }
  /** 대본 (.ecs 원문, script-format.md). 없으면 원작 장면 그대로 */
  script?: ScriptSource
  /** 9장 후 진로 선택지 문구 (루트 A·B·C) */
  routeLabels: [string, string, string]
  /** 진로선택 버튼 글자 (루트 A·B·C). 없으면 routeLabels. 개선판은 원작 장소 이름 + routeLabels 를 설명 칸에 */
  routePlaces?: [string, string, string]
  /** 진로 메뉴에 보일 순서 (루트 번호). 없으면 0·1·2 */
  routeOrder?: number[]
  /** 판이 더하는 전투 (장 번호 → 배치). 개선판 숨은 장 */
  extraBattles?: Record<number, ExtraBattle>
}
