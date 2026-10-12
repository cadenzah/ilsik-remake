// 화면 전환 페이드 (원작은 팔레트를 어둡게 → 다음 화면 → 밝게). 맨 위 검은 막의 투명도로 흉내 낸다.
// 이미 어두우면 fadeOut, 이미 밝으면 fadeIn 은 바로 끝난다 → 전환 경로마다 겹쳐 불러도 된다.
// transitionend 대신 setTimeout (숨은 탭에서도 끝나게)
export const FADE_MS = 400

let dark = false
const veil = () => {
  let e = document.getElementById('fade')
  if (!e) {
    e = document.createElement('div')
    e.id = 'fade'
    document.body.append(e)
  }
  return e
}
const sleep = (ms: number) => new Promise<void>(ok => setTimeout(ok, ms))

/** 검게. 어두운 동안은 클릭을 막는다 */
export function fadeOut(ms = FADE_MS): Promise<void> {
  if (dark) return Promise.resolve()
  dark = true
  const e = veil()
  e.style.transitionDuration = `${ms}ms`
  e.classList.add('on')
  return sleep(ms)
}

export function fadeIn(ms = FADE_MS): Promise<void> {
  if (!dark) return Promise.resolve()
  dark = false
  const e = veil()
  e.style.transitionDuration = `${ms}ms`
  e.classList.remove('on')
  return sleep(ms)
}
