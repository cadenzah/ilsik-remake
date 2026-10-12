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
}
