// 1장 페얼촌. 배치와 화자는 원작 미분석 상태의 근사치 (원작은 EXE 하드코딩으로 추정).
// 대사는 dialogue.json 의 인덱스로 참조한다.

export interface Placement { type: number; x: number; y: number; range?: [number, number] }
export interface Line { who: number; line: number }   // who = 유닛 종류 id (초상화·이름 출처)

export interface StageDef {
  n: number
  title: string
  allies: Placement[]
  enemies: Placement[]
  intro: Line[]
  outro: Line[]
  leader: number   // 이 유닛이 쓰러지면 패배
}

const ARIKUS = 0, LESDA = 18, CHIEF = 105

export const stage01: StageDef = {
  n: 1,
  title: '1장 · 페얼촌',
  leader: ARIKUS,
  allies: [
    { type: ARIKUS, x: 21, y: 3 },
    { type: LESDA, x: 22, y: 4 },
  ],
  enemies: [
    { type: 64, x: 4, y: 9 },    // 애수인
    { type: 64, x: 6, y: 12 },
    { type: 31, x: 2, y: 13 },   // 강시
    { type: 31, x: 8, y: 15 },
    { type: 63, x: 10, y: 12, range: [1, 2] }, // 화살병
  ],
  intro: [
    { who: ARIKUS, line: 0 }, { who: LESDA, line: 1 }, { who: CHIEF, line: 2 },
    { who: ARIKUS, line: 3 }, { who: CHIEF, line: 4 }, { who: ARIKUS, line: 5 },
    { who: CHIEF, line: 6 }, { who: ARIKUS, line: 7 }, { who: CHIEF, line: 8 },
    { who: LESDA, line: 9 }, { who: ARIKUS, line: 10 }, { who: CHIEF, line: 11 },
    { who: LESDA, line: 12 },
  ],
  outro: [{ who: ARIKUS, line: 13 }, { who: LESDA, line: 14 }],
}
