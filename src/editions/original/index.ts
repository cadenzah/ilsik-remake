// 원작판: 원작 로직·메커니즘 그대로. 편의 기능 없음 (.claude/docs/editions.md)
import type { Edition } from '../../core/edition'
import { planFor } from './ai'
import { order, rules } from './rules'

export const edition: Edition = {
  id: 'original',
  name: '원작판',
  rules,
  order,
  planFor,
  features: { threat: false, forecast: false, quickAttack: false },
  // 원작 선택지 문구는 그래픽이라 아직 못 읽었다 (story.md) — 그때까지 중립 표기
  routeLabels: ['첫째 길', '둘째 길', '셋째 길'],
}
