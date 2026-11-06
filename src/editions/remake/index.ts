// 개선판: 원작판을 바탕으로 덮어쓴다. 지금은 원작판 규칙 (혼수 버그 고침)·AI + 페이즈제 턴 + 편의 기능
import type { ExtraBattle } from '../../core/data'
import type { Edition } from '../../core/edition'
import { edition as original } from '../original'
import { mindNote, planFor } from './ai'
import { afterWin, ensureSeed, grow, partyChange, startFatigue } from './growth'
import { makeRules, type Tuning } from '../original/rules'
import { FLAGS } from '../../core/campaign'
import { difficulty } from '../../core/settings'
import aliases from '../../../content/remake/names.json'
import banter from '../../../content/remake/banter.ecs?raw'      // 동료 한마디 (제안 8)
import epilogue from '../../../content/remake/epilogue.ecs?raw'  // 에필로그 (제안 15)
import tune from '../../../content/remake/tune.json'            // 장별 조정 (B1 제안 6)
import par from '../../../content/remake/par.json'              // 장 평가 턴 기준 (제안 11·34, tools/sim.mjs --par 로 다시 만든다)

// 개선판 대본 (content/remake/chapters/NN.ecs, 저장소에 커밋). 원문 그대로 받아 core/script.ts 가 해석한다
const files = import.meta.glob<string>('../../../content/remake/chapters/*.ecs', { query: '?raw', import: 'default', eager: true })
// 진엔딩 숨은 장 배치 (content/remake/battles/NN.json, replay-design.md 4절)
const extra = import.meta.glob<ExtraBattle>('../../../content/remake/battles/*.json', { import: 'default', eager: true })
const extraBattles = Object.fromEntries(Object.entries(extra).map(([path, b]) => [Number(/(\d+)\.json$/.exec(path)![1]), b]))

// 적이 칠 때 = 물리 비율식 계수 0.19 · 생명상해 ×0.6 (B1 제안 1·2, balance-proposal.md "2번 마법 수치") 에 난이도 배율 (쉬움·보통·어려움 = ×0.8·1·1.2, settings.ts).
// 시뮬레이터 첫판 승 (1~9·10~25·26~43장): 쉬움 89·85·57%, 보통 79·69·38% (원작판 75·63·31%), 어려움 60·55·14%
const ENEMY = { coef: 0.19, spell: 0.6 }, DIFF_SCALE = [0.8, 1, 1.2]
const enemyHit: NonNullable<Tuning['enemy']> = { form: 'ratio', ...ENEMY }
/** 개선판 피해 조정 (tools/sim 이 이 값에서 바꿔 본다). 아군 = 물리 0.4, 마법·회복은 원작 그대로 */
// 고대 병기 특효 (B1 제안 24, Q7): 용자의검·빛의갑옷·무자의책·현자의돌을 지닌 수마다 제관·사바카 (세 형태) 의 방어를 덜 본다 — balance-proposal.md "24 고대 병기 특효"
export const ANCIENT = [58, 114, 148, 169], SABAKA_SIDE = [56, 97, 98, 99]
const bane = { items: ANCIENT, foes: SABAKA_SIDE, cut: 0.15 }
export const tuning: Tuning = { form: 'ratio', coef: 0.4, enemy: enemyHit, grow, bane }   // grow = 성장 난수 (N4, growth.ts)

export const edition: Edition = {
  ...original,
  id: 'remake',
  name: '개선판',
  // 물리 피해식 (B1 제안 1, 2026-11-01 시뮬레이터로 정함 — balance-proposal.md "1번 피해식"): 두 편 모두 비율식 c·A²/(A+D) (위 tuning).
  // 원작식의 "1 아니면 한두 방" 을 두 편 모두 없애고, 적이 아군보다 2~3배 많은 만큼 적 계수를 낮춰 난이도는 원작판 수준으로
  rules: makeRules(tuning),
  beginBattle() {
    const d = difficulty()
    enemyHit.coef = ENEMY.coef * DIFF_SCALE[d]
    enemyHit.spell = ENEMY.spell * DIFF_SCALE[d]
    FLAGS.add(`diff${d}`)
    ensureSeed()   // 성장 난수 판 씨앗 (N4)
  },
  // 근접 반격 원래 위력, 감쇠 없음 (B1 제안 3, 2026-11-06 ×½·감쇠 → ×1). 대신 적 생명 ×1.15 — balance-proposal.md "반격 원래 위력 + 적 생명"
  counter: { scale: 1, decay: 1 },
  foeHp: 1.15,
  zoc: true,
  par,
  tune: tune as unknown as Edition['tune'],
  afterWin,      // 대기 동료 경험치·쓰러진 대가 (B1 제안 5·12, growth.ts)
  startFatigue,  // 지난 장에 쓰러진 대원 피로 30 (제안 12)
  partyChange,   // 늦은 합류 맞춤·전직·교체 성장 이어받기 (제안 5·N2)
  mindNote,  // 성향 카드 줄 (제안 10)
  planFor,   // 개선판 AI = 점수식 (remake/ai.ts). 원작판은 원작 AI (original/ai.ts)
  // 페이즈제: 일행 전체 → NPC 전체 → 적 전체
  order(units) {
    const party = units.filter(u => u.troop === 0)
    const npc = units.filter(u => u.side === 'ally' && u.troop !== 0)
    const enemy = units.filter(u => u.side === 'enemy')
    return [party, npc, enemy].filter(s => s.length)
  },
  script: { files, aliases, banter, epilogue },
  extraBattles,
  features: { threat: true, forecast: true, quickAttack: true, commandFirst: false, autoRest: true, originalCamp: false },
  // S2 제안 1: 세 길을 목적으로 (story-proposal.md)
  routePlaces: original.routeLabels,
  routeLabels: ['레스다의 유언대로 유하 마을의 크란을 찾는다', '끌려간 소녀를 쫓아 북쪽 동굴로', '고신전을 지나 제국으로 곧장'],
}
