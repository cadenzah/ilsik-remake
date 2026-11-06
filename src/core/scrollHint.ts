// 스크롤 영역에 「위·아래에 더 있음」 표시 (2026-11-07 사용자: 스크롤이 생겨도 아래에 더 있는지 눈으로 알기 어렵다).
// macOS 등은 스크롤바가 숨어 있어서, 넘치는 쪽 가장자리를 흐리게 하고 (data-scroll = down·up·both) 얇은 스크롤바를 늘 보이게 한다 (style.css [data-scroll]).
// 아래 SELECTOR 에 맞는 요소가 DOM 에 생기면 알아서 붙는다. 새 스크롤 영역을 만들면 여기에 더한다.
const SELECTOR = [
  '.help .hb', '.help .hl', '#titlescreen .codex .cpane', '#titlescreen .wmap .clist',
  '.owin.log .b', '.owin.talklog .b', '.mc-list', '.mc-grid', '.mglist', '.mc-opts',
].join(', ')

const done = new WeakSet<Element>()

function update(el: HTMLElement) {
  const up = el.scrollTop > 2, down = el.scrollTop + el.clientHeight < el.scrollHeight - 2
  const v = up && down ? 'both' : down ? 'down' : up ? 'up' : ''
  if (v) el.dataset.scroll = v
  else if (el.dataset.scroll !== undefined) el.dataset.scroll = ''   // 넘치지 않음: 표시 없음 (스크롤바 꾸밈은 남긴다)
}

/** el 에 표시를 붙인다 (스크롤·크기·내용이 바뀔 때마다 다시 잰다) */
export function hintScroll(el: HTMLElement) {
  if (done.has(el)) return
  done.add(el)
  el.dataset.scroll = ''
  let queued = false
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(el) }) } }
  el.addEventListener('scroll', later, { passive: true })
  const ro = new ResizeObserver(later)
  const watchKids = () => { ro.disconnect(); ro.observe(el); for (const c of el.children) ro.observe(c) }
  new MutationObserver(() => { watchKids(); later() }).observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'class'] })
  watchKids()
  later()
}

/** 시작할 때 한 번: SELECTOR 에 맞는 스크롤 영역이 생기면 표시를 붙인다 */
export function installScrollHints() {
  let queued = false
  const scan = () => { queued = false; document.querySelectorAll<HTMLElement>(SELECTOR).forEach(hintScroll) }
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(scan) } }).observe(document.body, { childList: true, subtree: true })
  scan()
}
