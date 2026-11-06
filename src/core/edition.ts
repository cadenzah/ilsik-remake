// 판(에디션) 인터페이스. 엔진(core)은 공통이고, 규칙·행동 순서·AI·편의 기능은 판마다 다르다 (.claude/docs/editions.md)
import type { ScriptSource } from './script'
import type { ExtraBattle, Item, Magic, StageMap, StageTune, Tables, UnitType } from './data'
import type { BuffStat, Pos, Unit } from './unit'
import type { Camp, Note } from './campaign'

export interface Rules {
  /** 피해 범위 [최소, 최대]. at = 공격자가 칠 자리 (없으면 지금 자리, 지형 보정용), units = 맵의 유닛 (협공 보정용, 없으면 협공 없음 — 반격) */
  damageRange(map: StageMap, a: Unit, d: Unit, at?: Pos, units?: Unit[]): [number, number]
  rollDamage(map: StageMap, a: Unit, d: Unit, units?: Unit[]): number
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
  /** 컴퓨터 조종 유닛이 제 차례에 쉬는 선인가 (행동하는 부대일 때, original/ai.ts aiGate). 개선판은 맵·카드에 미리 보인다 (B1 N1) */
  aiRests(u: Unit): boolean
  /** 공격자가 대상에게 특효 (방어를 덜 봄, 개선판 B1 제안 24) 인가. 확인창 표시용. 없으면 특효 없음 */
  bane?(a: Unit, d: Unit): boolean
  /** 종족 × 마법 계열 상성 (개선판 B1 제안 25): 이 마법이 대상에게 주는 피해 배율 (생명상해만, 1 = 보통). 확인창 표시용. 없으면 상성 없음 */
  affinity?(m: Magic, d: Unit): number
  /** 상성 표 [종족][계열] = 배율 (카드·도감 표시용) */
  affinityTable?: Record<number, Record<number, number>>
  /** 협공 보정 (개선판 B1 제안 30): 대상 옆에 붙은 공격자 편 수만큼 오르는 물리 피해 비율 (0.2 = +20%). 확인창 표시용. 없으면 협공 없음 */
  flank?(a: Unit, d: Unit, units: Unit[]): number
  /** 전력 공격·방어 태세 (개선판 B1 제안 27). 없으면 두 명령이 없다 */
  stance?: Stance
  /** 이 유닛이 한 차례에 두 번 행동하나 (차례를 마칠 때 검사) */
  actsTwice(u: Unit): boolean
  /** 차례 시작 처리 (중독 피해·혼수·강화 되돌림). 유닛을 바꾸고 일어난 일을 돌려준다 */
  statusTick(u: Unit): { poison: number; coma: boolean }
  /** 행동 하나로 얻는 경험치 (일행만 부른다). hits = 대상마다 값 (물리·생명상해 = 피해, 회복 = 회복량, 그 밖 0), 대상 HP 0 = 쓰러뜨림.
   *  magic = 쓴 마법, cured = 마법으로 상태가 풀린 대상 수 */
  expGain(a: Unit, hits: { target: Unit; value: number }[], magic?: Magic, cured?: number): number
  /** 레벨 하나 오른 뒤 처리 (u.type.lv 는 이미 올렸다). 유닛·u.type (일행 사본) 을 바꾸고 바뀐 것을 돌려준다. route = 지금 루트 */
  levelUp(u: Unit, tables: Tables, route: number): LevelUp
}

/** 피로를 쓰는 명령 (개선판 B1 제안 27). 전력 공격 = 물리 피해 ×dmg, 그 공격으로 쌓이는 피로 ×tire.
 *  방어 태세 = 움직이지 않은 차례에 휴식 대신. 다음 제 차례까지 물리 방어 (피해식의 D) ×def, 피로 −rest (생명은 회복 없음, 휴식보다 덜) */
export interface Stance { dmg: number; tire: number; def: number; rest: number }

/** 레벨업 결과. gains = 생명(최대)·역량·방어·정신·민첩 증가, weapon·armor = 승급한 장비 Item id, magic = 배운 마법 id.
 *  offer = 무기·방어구 승급을 받을 수 있게 됨 (개선판 B1 제안 36, 바로 쓰지 않고 UnitType.promo 에 쌓는다) */
export interface LevelUp { gains: [number, number, number, number, number]; weapon?: number; armor?: number; magic?: number; offer?: [boolean, boolean] }

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
  /** 컴퓨터 유닛 성향 한 줄 (개선판 카드, B1 제안 10). 없으면 '' */
  mindNote?(u: Unit): string
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
  /** 전투를 시작할 때 (다시 하기 포함, 장 사이 상태를 되돌린 뒤). 개선판 = 난이도를 규칙에 넣고 판 플래그에 남김 */
  beginBattle?(): void
  /** 전투에서 이긴 직후, 전투 후 단계 전. 개선판 = 대기 동료 경험치 (B1 제안 5)·쓰러진 대가 (제안 12). 알림은 notes 에, start = 이 장 시작 상태 */
  afterWin?(notes: Note[], start?: Camp): void
  /** 일행 대원의 전투 시작 피로 (없으면 PAD 값). 개선판 = 지난 장에 쓰러진 대원 (제안 12) */
  startFatigue?(t: UnitType): number | undefined
  /** 일행이 바뀐 뒤 (campaign.ts). join = 합류, change = 같은 인물이 새 종류로 (전직·교체, old = 바꾸기 전 일행 사본).
   *  개선판 = 늦은 합류 레벨 맞춤 (제안 5)·성장 이어받기 (N2) */
  partyChange?(e: { join: number } | { change: number; old: UnitType }, notes: Note[]): void
  /** 근접 반격 (battleCore counterDamage). 없으면 반격 없음. 개선판 = 제안 3 */
  counter?: { scale: number; decay: number }
  /** 적 최대 생명 배율 (모든 장, tune foeScale 과 곱). 없으면 1 */
  foeHp?: number
  /** 통제 영역 (grid.ts reachable): 상대 옆 칸에 들어가면 이동이 멈춘다. 없으면 원작 통행 그대로. 개선판 = 제안 13 */
  zoc?: boolean
  /** 장 평가 "N턴 안에 이긴다" 의 N (키 "장-루트", core/grade.ts). 없으면 장 평가 없음. 개선판 = content/remake/par.json (제안 11·34) */
  par?: Record<string, number>
  /** 장별 조정 (키 "장" 또는 "장-루트"). 개선판 = content/remake/tune.json */
  tune?: Record<string, StageTune>
  /** 판이 더하는 전투 (장 번호 → 배치). 개선판 숨은 장 */
  extraBattles?: Record<number, ExtraBattle>
}
