// 개선판 장 평가 = 화면 이름 「도전 과제」 (B1 제안 11·34, balance-proposal.md "11·34 장 평가"): 장마다 같은 꼴의 보조 목표 셋 → 달성한 수만큼 별.
//   N턴 안에 이긴다 (N = Edition.par, 시뮬레이터가 이긴 판의 턴 중앙값 — 없는 장은 빼고)
//   아무도 쓰러지지 않는다 (일행 대원, 자리를 비운 대원은 빼고)
//   보물 상자를 모두 연다 (보물이 있는 장만, 원작 숨은 보물 — 개선판은 지도에 상자로 그린다)
// 보상은 없다 (사용자 결정 2026-11-06: 원작이 이미 장마다 보상 도구를 준다). 대본의 이야기 보조 목표 (script.ts goal) 는 별에 넣지 않는다
import { taken } from './battleCore'
import type { GoalState } from './script'
import { S } from './state'

export interface Mark { text: string; state: GoalState }

/** 이 장의 평가 목표와 지금 상태. won = 이긴 뒤 (아직 열린 것을 매듭짓는다). 개선판이 아니면 빈 배열 */
export function stageMarks(won = false): Mark[] {
  if (!S.ed.par) return []
  const marks: Mark[] = []
  const par = S.ed.par[`${S.def.n}-${S.def.route}`]
  const close = (ok: boolean): GoalState => ok ? (won ? 'done' : 'open') : 'failed'
  if (par) marks.push({ text: `${par}턴 안에 이긴다`, state: close(S.turn <= par) })
  const down = S.units.some(u => u.troop === 0 && u.hp <= 0 && !u.absent)
  marks.push({ text: '아무도 쓰러지지 않는다', state: close(!down) })
  const all = S.treasure.length
  if (all) {
    const got = taken.size
    marks.push({ text: `보물 상자를 모두 연다 (${got} / ${all})`, state: got === all ? 'done' : won ? 'failed' : 'open' })
  }
  return marks
}

/** 별 글자: 얻은 수만큼 ★, 나머지 ☆ */
export const starText = (got: number, max: number) => '★'.repeat(got) + '☆'.repeat(Math.max(0, max - got))
