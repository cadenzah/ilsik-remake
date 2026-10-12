// 캠페인: 장 사이 플래그와 원작 장면 재생 목록
import { S } from './state'

// 캠페인 플래그. 장 연결이 없는 동안 npc19 는 켜 둔다 (npc19 = 19장 용왕 생존 → 36장 루이스 출현·합류,
// black27 = 27장 흑기사 출현 → 27장 후 아보라한 합류·장면)
export const FLAGS = new Set<string>(['npc19'])

export const joinLine = (type: number) => ({ text: `${S.types[type].name}이(가) 일행에 합류했다.` })

// 선택지 분기는 아직 UI 가 없어 '예'(1) 쪽을 재생한다
export function sceneLines(keys: string[]) {
  return keys.flatMap(k => S.scenes.scenes[k] ?? []).filter(([, , br]) => br !== 2)
    .map(([who, line]) => ({ who: who >= 0 ? S.types[who] : undefined, text: S.dialogue[line] }))
}

// 승리 후 장면. 원작은 합류 처리 뒤 대화를 띄우지만 알림은 대화 끝에 보여 준다
export function postLines(stage: number) {
  const steps = (S.scenes.post[stage] ?? [])
    .filter(s => (!s.routes || s.routes.includes(S.def.route)) && (!s.flag || FLAGS.has(s.flag)) && s.item === undefined)  // 장 사이 소지품은 아직 없음
  return [...sceneLines(steps.flatMap(s => 'scene' in s ? [s.scene] : [])),
    ...steps.flatMap(s => 'join' in s ? [joinLine(s.join)] : [])]
}

export type Next = { n: number; route: number } | { choose: [number, number, number] } | null

/** 전투 순서표로 다음 장을 찾는다. 진로 선택 장(9장) 뒤면 루트별 첫 장 3개, 마지막 장이면 null */
export function nextStage(n: number, route: number): Next {
  const T = S.routeTable
  const i = T.findIndex((row, k) => k > 0 && row[route] === n)
  const row = T[i + 1]
  if (i < 0 || !row || row[route] === n) return null   // 29행은 43장 중복
  if (n === S.scenes.routeSelectAfter) return { choose: [row[0], row[1], row[2]] }
  return { n: row[route], route }
}
