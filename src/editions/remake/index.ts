// 개선판: 원작판을 바탕으로 덮어쓴다. 지금은 원작판 규칙·AI + 페이즈제 턴 + 편의 기능
import type { Edition } from '../../core/edition'
import { edition as original } from '../original'

export const edition: Edition = {
  ...original,
  id: 'remake',
  name: '개선판',
  // 페이즈제: 일행 전체 → NPC 전체 → 적 전체
  order(units) {
    const party = units.filter(u => u.troop === 0)
    const npc = units.filter(u => u.side === 'ally' && u.troop !== 0)
    const enemy = units.filter(u => u.side === 'enemy')
    return [party, npc, enemy].filter(s => s.length)
  },
  features: { threat: true, forecast: true, quickAttack: true },
  // S2 제안 1: 세 길을 목적으로 (story-proposal.md)
  routeLabels: ['레스다의 유언대로 유하 마을의 크란을 찾는다', '끌려간 소녀를 쫓아 북쪽 동굴로', '고신전을 지나 제국으로 곧장'],
}
