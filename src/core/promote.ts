// 애슬 전직 장면 (원작 2ff8:0799, formats.md "전직"): 정비 화면 뒤·대륙 지도 전, 검은 화면 (264,200) 에 ECLIPSE1.FAT 묶음 11
// (112×85, 애슬이 「My Queen」 SM여왕으로 바뀜) 을 0xa0 ms 간격으로 돌리고 끝 프레임에서 0x5dc ms 멈춘다. 자원 ui/promote.png (export_web.py promote)
import { A } from './data'
import { fadeIn, fadeOut } from './fade'

const W = 112, H = 85, COLS = 10, FRAMES = 38
const FRAME_MS = 0xa0, HOLD_MS = 0x5dc

/** 화면이 어두운 상태에서 불러 장면을 밝혔다가 다시 어둡게 한다. 클릭·키로 넘긴다. caption = 끝 프레임에서 보일 아래 글 (개선판, 그만큼 더 멈춘다) */
export async function promoteScene(caption?: string) {
  const root = document.createElement('div')
  root.id = 'promote'
  root.innerHTML = `<div class="stage"><i class="anim"></i>${caption ? `<p class="cap"></p>` : ''}</div>`
  const stage = root.querySelector<HTMLElement>('.stage')!, anim = root.querySelector<HTMLElement>('.anim')!
  if (caption) root.querySelector('.cap')!.textContent = caption
  anim.style.backgroundImage = `url(${A}/ui/promote.png)`
  const show = (f: number) => anim.style.backgroundPosition = `-${(f % COLS) * W}px -${Math.floor(f / COLS) * H}px`
  show(0)
  const fit = () => stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / 640, innerHeight / 480)})`
  fit()
  addEventListener('resize', fit)
  document.body.append(root)
  const img = new Image()
  img.src = `${A}/ui/promote.png`
  await img.decode().catch(() => {})
  await fadeIn()
  await new Promise<void>(ok => {
    let f = 0, t = 0
    const done = () => { clearTimeout(t); root.removeEventListener('pointerdown', done); removeEventListener('keydown', done, true); ok() }
    const step = () => { if (++f < FRAMES) { show(f); t = setTimeout(step, FRAME_MS) } else { root.classList.add('end'); t = setTimeout(done, HOLD_MS * (caption ? 2 : 1)) } }
    t = setTimeout(step, FRAME_MS)
    root.addEventListener('pointerdown', done)
    addEventListener('keydown', done, true)
  })
  await fadeOut()
  removeEventListener('resize', fit)
  root.remove()
}
