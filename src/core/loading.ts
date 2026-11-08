// 자원 기다리기·불러오는 중 표시. 배포판 (첫 실행·느린 망) 에서 그림·글꼴이 오기 전에 화면이 먼저 밝아지거나
// 대화창에 직전 화자 초상이 남는 일을 막는다. 기다림이 짧으면 아무것도 안 보이고, 길어지면 오른쪽 아래에 「불러오는 중」.
// 기다림은 늘 상한이 있다 (망이 끊겨도 게임이 멈추지 않게, 못 받은 그림은 빈 채로 간다)

const SHOW_AFTER = 350   // 이보다 오래 걸릴 때만 표시
// 받은 Image 를 붙잡아 둔다: 놓으면 GC 뒤 브라우저 메모리에서 빠져, 다음 <img> 가 서버에 다시 물어보느라 늦게 뜬다
// (전투 중 안내 대사의 초상이 대사보다 늦게 붙던 까닭, 2026-11-09). 초상 전부 붙잡아도 몇 MB
const images = new Map<string, { im: HTMLImageElement; p: Promise<void>; done: boolean }>()

/** 그림 하나를 받아 둔다 (같은 주소는 한 번). decode() 는 숨은 탭에서 끝나지 않을 수 있어 load 이벤트로.
 *  받기를 마쳤는데 지금 없으면 (못 받음·메모리에서 빠짐) 다시 받는다 — 끝난 Promise 를 돌려주면 기다리는 쪽이 안 기다린다 */
export function imgReady(url: string): Promise<void> {
  const had = images.get(url)
  if (had && (!had.done || imgLoaded(url))) return had.p
  const im = new Image()
  const e = { im, p: Promise.resolve(), done: false }
  e.p = new Promise<void>(ok => { im.onload = im.onerror = () => { e.done = true; ok() } })
  im.src = url
  images.set(url, e)
  return e.p
}

/** 받아 둔 그림인가 (기다릴 필요 없음) */
export function imgLoaded(url: string): boolean {
  const im = new Image()
  im.src = url
  return im.complete && im.naturalWidth > 0
}

const within = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>(ok => setTimeout(ok, ms))])

/** root 아래 아직 안 온 <img> 와 글꼴을 기다린다 (최대 ms) */
export function pageReady(root: ParentNode = document, ms = 8000): Promise<unknown> {
  const pending = [...root.querySelectorAll('img')].filter(im => im.src && !im.complete)
    .map(im => new Promise<void>(ok => { im.addEventListener('load', () => ok(), { once: true }); im.addEventListener('error', () => ok(), { once: true }) }))
  const fonts = document.fonts?.status === 'loading' ? document.fonts.ready : null
  if (!pending.length && !fonts) return Promise.resolve()
  return within(Promise.all([...pending, fonts]), ms)
}

let shown = 0
let el: HTMLElement | null = null
/** p 를 기다리는 동안 (SHOW_AFTER 를 넘기면) 「불러오는 중」 */
export async function busy<T>(p: Promise<T>): Promise<T> {
  let on = false
  const t = setTimeout(() => {
    on = true
    if (!shown++) {
      el ??= Object.assign(document.createElement('div'), { id: 'loading', textContent: '불러오는 중' })
      document.body.append(el)
    }
  }, SHOW_AFTER)
  try { return await p }
  finally {
    clearTimeout(t)
    if (on && !--shown) el?.remove()
  }
}
