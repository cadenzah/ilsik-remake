// 개선판: 원작판을 바탕으로 덮어쓴다. 지금은 원작판 규칙 (혼수 버그 고침)·AI + 페이즈제 턴 + 편의 기능
import type { ExtraBattle } from '../../core/data'
import type { Edition } from '../../core/edition'
import { edition as original } from '../original'
import { planFor } from './ai'
import { makeRules } from '../original/rules'
import aliases from '../../../content/remake/names.json'
import banter from '../../../content/remake/banter.ecs?raw'      // 동료 한마디 (제안 8)
import epilogue from '../../../content/remake/epilogue.ecs?raw'  // 에필로그 (제안 15)

// 개선판 대본 (content/remake/chapters/NN.ecs, 저장소에 커밋). 원문 그대로 받아 core/script.ts 가 해석한다
const files = import.meta.glob<string>('../../../content/remake/chapters/*.ecs', { query: '?raw', import: 'default', eager: true })
// 진엔딩 숨은 장 배치 (content/remake/battles/NN.json, replay-design.md 4절)
const extra = import.meta.glob<ExtraBattle>('../../../content/remake/battles/*.json', { import: 'default', eager: true })
const extraBattles = Object.fromEntries(Object.entries(extra).map(([path, b]) => [Number(/(\d+)\.json$/.exec(path)![1]), b]))

export const edition: Edition = {
  ...original,
  id: 'remake',
  name: '개선판',
  // 물리 피해식 (B1 제안 1, 2026-11-01 시뮬레이터로 정함 — balance-proposal.md "1번 피해식"): 비율식 c·A²/(A+D), 아군 c = 0.4 · 적 c = 0.15.
  // 원작식의 "1 아니면 한두 방" 을 두 편 모두 없애고, 적이 아군보다 2~3배 많은 만큼 적 계수를 낮춰 난이도는 원작판 수준으로
  rules: makeRules({ form: 'ratio', coef: 0.4, enemy: { form: 'ratio', coef: 0.15 } }),
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
