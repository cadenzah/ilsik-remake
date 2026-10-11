// 1장 페얼촌. 배치는 원작 ECLIPSE.BAD (battles.json) 에서 읽는다.
// 화자·출전 일행은 아직 근사치 (E3 에서 확정). 대사는 dialogue.json 의 인덱스로 참조한다.

export interface Placement { type: number; x: number; y: number; awake?: boolean }
export interface Line { who: number; line: number }   // who = 유닛 종류 id (초상화·이름 출처)

export interface StageDef {
  n: number
  title: string
  route: number      // ECLIPSE.BAD 루트 (0~2)
  party: number[]    // 출전 칸에 순서대로 놓을 유닛 종류 id
  intro: Line[]
  outro: Line[]
  leader: number   // 이 유닛이 쓰러지면 패배
}

const ARIKUS = 0, LESDA = 18, CHIEF = 105

export const stage01: StageDef = {
  n: 1,
  title: '1장 · 페얼촌',
  leader: ARIKUS,
  route: 0,
  party: [ARIKUS, LESDA],   // 원작 출전 칸 3개, 초기 일행 미확정
  intro: [
    { who: ARIKUS, line: 0 }, { who: LESDA, line: 1 }, { who: CHIEF, line: 2 },
    { who: ARIKUS, line: 3 }, { who: CHIEF, line: 4 }, { who: ARIKUS, line: 5 },
    { who: CHIEF, line: 6 }, { who: ARIKUS, line: 7 }, { who: CHIEF, line: 8 },
    { who: LESDA, line: 9 }, { who: ARIKUS, line: 10 }, { who: CHIEF, line: 11 },
    { who: LESDA, line: 12 },
  ],
  outro: [{ who: ARIKUS, line: 13 }, { who: LESDA, line: 14 }],
}
