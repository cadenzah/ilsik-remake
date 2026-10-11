// 1장 페얼촌. 배치는 ECLIPSE.BAD (battles.json), 일행·대화는 EXE 에서 추출한 scenes.json 을 쓴다.

export interface Placement { type: number; x: number; y: number; awake?: boolean }

export interface StageDef {
  n: number
  title: string
  route: number      // ECLIPSE.BAD 루트 (0~2)
  leader: number     // 이 유닛이 쓰러지면 패배
}

export const stage01: StageDef = { n: 1, title: '1장 · 페얼촌', route: 0, leader: 0 }
