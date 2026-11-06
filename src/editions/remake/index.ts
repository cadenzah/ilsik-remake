// 개선판: 원작판을 바탕으로 덮어쓴다. 지금은 원작판 규칙 (혼수 버그 고침)·AI + 페이즈제 턴 + 편의 기능
import type { ExtraBattle } from '../../core/data'
import type { Edition } from '../../core/edition'
import { edition as original } from '../original'
import { mindNote, planFor } from './ai'
import { afterWin, ensureSeed, grow, partyChange, startFatigue } from './growth'
import { affinity, affinityNote, affinityTags } from './affinity'
import { makeRules, type Tuning } from '../original/rules'
import { FLAGS } from '../../core/campaign'
import { S } from '../../core/state'
import { difficulty } from '../../core/settings'
import aliases from '../../../content/remake/names.json'
import banter from '../../../content/remake/banter.ecs?raw'      // 동료 한마디 (제안 8)
import epilogue from '../../../content/remake/epilogue.ecs?raw'  // 에필로그 (제안 15)
import recall from '../../../content/remake/recall.ecs?raw'      // 레스다 회상 (B1 제안 42)
import tune from '../../../content/remake/tune.json'            // 장별 조정 (B1 제안 6)
import par from '../../../content/remake/par.json'              // 장 평가 턴 기준 (제안 11·34, tools/sim.mjs --par 로 다시 만든다)

// 개선판 대본 (content/remake/chapters/NN.ecs, 저장소에 커밋). 원문 그대로 받아 core/script.ts 가 해석한다
const files = import.meta.glob<string>('../../../content/remake/chapters/*.ecs', { query: '?raw', import: 'default', eager: true })
// 진엔딩 숨은 장 배치 (content/remake/battles/NN.json, replay-design.md 4절)
const extra = import.meta.glob<ExtraBattle>('../../../content/remake/battles/*.json', { import: 'default', eager: true })
const extraBattles = Object.fromEntries(Object.entries(extra).map(([path, b]) => [Number(/(\d+)\.json$/.exec(path)![1]), b]))

// 적이 칠 때 = 물리 비율식 계수 0.19 · 생명상해 ×0.6 (B1 제안 1·2, balance-proposal.md "2번 마법 수치") 에 난이도 배율 (아래 DIFF_SCALE, settings.ts).
// 시뮬레이터 첫판 승 (1~9·10~25·26~41·42~43장, 2026-11-06 씨앗 1~16): 보통 96·92·81·36%, 어려움 85·79·60·18%
const ENEMY = { coef: 0.19, spell: 0.6 }
// 어려움 = ×1.1 + 적 협공 (2026-11-06, 그전 ×1.2 와 첫판 승이 같게 — balance-proposal.md "30 협공")
export const DIFF_SCALE = [0.8, 1, 1.1]
const enemyHit: NonNullable<Tuning['enemy']> = { form: 'ratio', ...ENEMY }
/** 개선판 피해 조정 (tools/sim 이 이 값에서 바꿔 본다). 아군 = 물리 0.4, 마법·회복은 원작 그대로 */
// 고대 병기 특효 (B1 제안 24, Q7): 용자의검·빛의갑옷·무자의책·현자의돌을 지닌 수마다 제관·사바카 (세 형태) 의 방어를 덜 본다 — balance-proposal.md "24 고대 병기 특효"
export const ANCIENT = [58, 114, 148, 169], SABAKA_SIDE = [56, 97, 98, 99]
const bane = { items: ANCIENT, foes: SABAKA_SIDE, cut: 0.15 }
// 피로를 쓰는 명령 (B1 제안 27): 전력 공격 = 피해 ×1.3·공격 피로 ×2, 방어 태세 = 물리 방어 ×1.2·제자리면 피로 −15 — balance-proposal.md "27 피로 명령"
const stance = { dmg: 1.3, tire: 2, def: 1.2, rest: 15 }
// 포위·협공 (B1 제안 30): 대상 옆에 붙은 아군 1명마다 물리 피해 +10%, 최대 +30%. 일행·NPC 는 늘, 적은 어려움에서만 (applyDifficulty) — balance-proposal.md "30 협공"
const flank = { per: 0.1, max: 0.3 }
// 상성 (B1 제안 25·25-2): 종족·비행·시전자 속성·중갑 — remake/affinity.ts, balance-proposal.md "25 종족 상성"·"25-2 맞붙음 늘리기". 두 편 모두
enemyHit.affinity = affinity
// 승급 고르기 (B1 제안 36): 레벨업 때 장비 승급을 바로 쓰지 않고 「승급 / 나중에」, 받지 않은 승급은 정비 화면에서 (core/campaign.ts takePromo)
export const tuning: Tuning = { form: 'ratio', coef: 0.4, enemy: enemyHit, grow, bane, stance, flank, promoChoice: true, affinity }
/** 난이도 (0 쉬움 · 1 보통 · 2 어려움) 를 적 조정에. hardFlank = 어려움에서 적도 협공 (tools/sim 이 끄고 비교) */
export function applyDifficulty(d: number, hardFlank = true) {
  S.diff = d   // 장별 조정의 hard (core/battleCore stageTune)
  enemyHit.coef = ENEMY.coef * DIFF_SCALE[d]
  enemyHit.spell = ENEMY.spell * DIFF_SCALE[d]
  enemyHit.flank = d === 2 && hardFlank ? flank : undefined
}   // grow = 성장 난수 (N4, growth.ts)

export const edition: Edition = {
  ...original,
  id: 'remake',
  name: '개선판',
  // 물리 피해식 (B1 제안 1, 2026-11-01 시뮬레이터로 정함 — balance-proposal.md "1번 피해식"): 두 편 모두 비율식 c·A²/(A+D) (위 tuning).
  // 원작식의 "1 아니면 한두 방" 을 두 편 모두 없애고, 적이 아군보다 2~3배 많은 만큼 적 계수를 낮춰 난이도는 원작판 수준으로
  rules: makeRules(tuning),
  beginBattle() {
    const d = difficulty()
    applyDifficulty(d)
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
  affinityText: (t, raceName, magic) => ({ tags: affinityTags(t, raceName, magic), note: affinityNote(t, magic) }),   // 상성 글 (제안 25)
  planFor,   // 개선판 AI = 점수식 (remake/ai.ts). 원작판은 원작 AI (original/ai.ts)
  // 페이즈제: 일행 전체 → NPC 전체 → 적 전체
  order(units) {
    const party = units.filter(u => u.troop === 0)
    const npc = units.filter(u => u.side === 'ally' && u.troop !== 0)
    const enemy = units.filter(u => u.side === 'enemy')
    return [party, npc, enemy].filter(s => s.length)
  },
  script: { files, aliases, banter, epilogue, recall },
  extraBattles,
  features: { threat: true, forecast: true, quickAttack: true, commandFirst: false, autoRest: true, originalCamp: false },
  // S2 제안 1: 세 길을 목적으로 (story-proposal.md)
  routePlaces: original.routeLabels,
  routeLabels: ['레스다의 유언대로 유하 마을의 크란을 찾는다', '끌려간 소녀를 쫓아 북쪽 동굴로', '고신전을 지나 제국으로 곧장'],
}
