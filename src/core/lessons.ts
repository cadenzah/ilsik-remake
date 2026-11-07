// 1장 차례차례 배우기 (tips-proposal.md 7절): 아직 배우지 않은 개선판 규칙을 그 전투 동안 꺼 둔다 (반격·협공은 양쪽 모두, 전력 공격·방어는 일행 메뉴에서 뺀다).
// tips.ts beginLessons 가 잠그고 openCounter·turnTips 가 푼다. 비어 있으면 (원작판·안내 끔·2장부터·시뮬레이터) 모든 규칙이 그대로
export type Lesson = 'counter' | 'flank' | 'stance'
export const locked = new Set<Lesson>()
