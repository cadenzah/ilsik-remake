// 판(에디션) 인터페이스. 엔진(core)은 공통이고, 규칙·행동 순서·AI·편의 기능은 판마다 다르다 (.claude/docs/editions.md)
import type { Item, StageMap, UnitType } from './data'
import type { Pos, Unit } from './unit'

export interface Rules {
  /** 피해 범위 [최소, 최대] */
  damageRange(a: Unit, d: Unit): [number, number]
  rollDamage(a: Unit, d: Unit): number
  /** 사거리 [최소, 최대] */
  weaponRange(t: UnitType, items: Map<number, Item>): [number, number]
  /** 휴식 회복량 (최대HP 를 넘지 않게는 엔진이 자른다) */
  restHeal(u: Unit): number
}

export interface AiPlan { unit: Unit; dest: Pos; target?: Unit }

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
   *  autoRest = 이동·공격 없이 차례를 마치면 휴식, 아니면 휴식은 "휴식?" 확인으로만 (원작) */
  features: { threat: boolean; forecast: boolean; quickAttack: boolean; commandFirst: boolean; autoRest: boolean }
  /** 9장 후 진로 선택지 문구 (루트 A·B·C) */
  routeLabels: [string, string, string]
}
