// 보물 상자 도트 (개선판 features.chests — 원작에 상자 그림이 없어 웹이 그림, 2026-11-09).
// 색은 원작 그림에서 뽑았다: 나무·외곽선 = 22장 항구 나무 상자·통 (외곽선은 검정이 아니라 짙은 적갈색 #40181c),
// 쇠띠 = 통의 회색 단계, 자물쇠 금빛·흰 빛 = 유닛 그림의 밝은 색, 그림자 = 유닛 발밑과 같은 체크 망점.
// 판자는 원작 나무 상자처럼 윗줄 밝게 · 가는 가로 결을 한 단계씩 번갈아 · 이음은 어두운 줄. 위에서 내려다본 3/4 시점 (뚜껑 윗면이 보임)
// 격자: 한 글자 = 한 화소, '.' = 투명

const PAL: Record<string, string> = {
  o: '#40181c',
  1: '#64401c', 2: '#785020', 3: '#a47028', 4: '#d09028', 5: '#dcb870', 6: '#ecd084',
  k: '#3c3c3c', m: '#5c5c58', n: '#7c7c74', g: '#9c9c90', h: '#bcbca8',
  y: '#fcbc50', w: '#fcfcd8', d: '#202020', s: '#202020',
}

const ROWS: Record<'closed' | 'open', string[]> = {
  closed: [
    '..oooooooooooooooooooooooooo......',
    '.o666hhg66666666666666hhg666o.....',
    'o6555hhg55555555555545hhg5553o....',
    'o6444hhg44454444554444hhg5443o....',
    'o1111hgn11111111111111hgn111oo....',
    'o6555hgn55555555555555hgn5554o....',
    'o5444hgn34443434444444hgn4443o....',
    'o4333hgn33433333333333hgn3332o....',
    'o3222hgn2222oooooo2222hgn2221o....',
    'o4333gnm3333owwy4o3333gnm3333o....',
    'o1111nmk1111owyy4o1111nmk1111o....',
    'oooooooooooooyoo4ooooooooooooo....',
    'o6555gnm5555oyoo4o5555gnm5554o....',
    'o5444ghm4444o4444o3444ghm4433o....',
    'o4334gnm3343oooooo3333gnm3332o....',
    'o1111gnm11111111111111gnm111oo....',
    'o6555gnm55555555555555gnm5554o....',
    'o5444gnm44444444444444gnm4433o....',
    'o4433gnm33333333333343gnm3443o....',
    'o1111gnm11111111111111gnm111oo....',
    'o5444nmk44444444444444nmk4443o....',
    'o4333nmk32333333333333nmk3332o....',
    'o3322nhk22223222222232nhk2221o....',
    'o2111nmk11111111111111nmk1111o....',
    'o1111nmk11111111111111nmk1111os.s.',
    '.oooooooooooooooooooooooooooos.s.s',
    '..s.s.s.s.s.s.s.s.s.s.s.s.s.s.s.s.',
    '...s.s.s.s.s.s.s.s.s.s.s.s.s.s.s..',
    '......s.s.s.s.s.s.s.s.s.s.s.s.....',
  ],
  open: [
    '..oooooooooooooooooooooooooo......',
    'oo333nmk33333333333333nmk333oo....',
    'oo222nmk22222222222212nmk222oo....',
    'oo111nmk11111111111111nmk111oo....',
    'oo222mkk22222222222222mkk222oo....',
    'oo111mkk11111111111111mkk111oo....',
    'oo111mkk11111111111111mkk111oo....',
    'oooooooooooooooooooooooooooooo....',
    'o2oooooooooooooooooooooooooo1o....',
    'o2dddddddddddddddddddddddddd1o....',
    'o2dddddddddddddddddddddddddd1o....',
    'o6666666666666666666666666655o....',
    'o6555gnm5555oooooo5555gnm5554o....',
    'o5444ghm4444owwy4o3444ghm4433o....',
    'o4334gnm3343owyy4o3333gnm3332o....',
    'o1111gnm1111oyoo4o1111gnm111oo....',
    'o6555gnm5555oyoo4o5555gnm5554o....',
    'o5444gnm4444o4444o4444gnm4433o....',
    'o4433gnm3333oooooo3343gnm3443o....',
    'o1111gnm11111111111111gnm111oo....',
    'o5444nmk44444444444444nmk4443o....',
    'o4333nmk32333333333333nmk3332o....',
    'o3322nhk22223222222232nhk2221o....',
    'o2111nmk11111111111111nmk1111o....',
    'o1111nmk11111111111111nmk1111os.s.',
    '.oooooooooooooooooooooooooooos.s.s',
    '..s.s.s.s.s.s.s.s.s.s.s.s.s.s.s.s.',
    '...s.s.s.s.s.s.s.s.s.s.s.s.s.s.s..',
    '......s.s.s.s.s.s.s.s.s.s.s.s.....',
  ],}

/** 상자 그림 크기 (그림자 포함) 와 칸 안 자리: 칸 (56×48) 가운데 아래, 발밑이 유닛 그림자 높이에 */
export const CHEST = { w: ROWS.closed[0].length, h: ROWS.closed.length, x: 13, y: 18 }
/** 자물쇠 가운데 (닫힌 상자, 그림 기준) — 반짝임 자리 */
export const CHEST_LOCK = { x: 14.5, y: 11 }

const cache = new Map<string, HTMLCanvasElement>()
export function chestImage(open: boolean): HTMLCanvasElement {
  const k = open ? 'open' : 'closed'
  let c = cache.get(k)
  if (c) return c
  c = document.createElement('canvas')
  c.width = CHEST.w; c.height = CHEST.h
  const cx = c.getContext('2d')!
  ROWS[k].forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.') return
    cx.fillStyle = PAL[ch]; cx.fillRect(x, y, 1, 1)
  }))
  cache.set(k, c)
  return c
}
