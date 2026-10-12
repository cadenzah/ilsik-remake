// 장 정의. 배치는 ECLIPSE.BAD (battles.json), 일행·대화는 EXE 에서 추출한 scenes.json 을 쓴다.

export interface Placement { type: number; x: number; y: number; troop: number; member: number }

export interface StageDef {
  n: number
  title: string
  route: number      // ECLIPSE.BAD 루트 (0~2)
  campaign?: boolean // 이어하기·새로 시작으로 들어온 판. 클리어하면 진행을 저장하고 다음 장으로 갈 수 있다
}

const PLACES: Record<number, string> = { 1: '페얼촌' }   // 장소명은 S3a 장소 카드 때 채운다

export const stageDef = (n: number, route = 0, campaign = false): StageDef =>
  ({ n, route, campaign, title: PLACES[n] ? `${n}장 · ${PLACES[n]}` : `${n}장` })
