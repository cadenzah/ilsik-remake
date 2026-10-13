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
  features: { threat: false, forecast: false, quickAttack: false, commandFirst: true, autoRest: false, originalCamp: true },
  // 원작 진로 메뉴 (0aa2:0b0d, DS:0x9ae~): 메뉴 순서 암흑동굴(B)·혼탁한호수(A)·옛 신전(C)
  routeLabels: ['혼탁한호수', '암흑동굴', '옛 신전'],
  routeOrder: [1, 0, 2],
}
