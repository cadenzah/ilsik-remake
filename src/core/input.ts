// 마우스·키보드·터치 입력 (ux-proposal.md 7·8·19·28). 좌표는 모두 논리 좌표 (screen.toLogical)
// 두 판: 왼쪽 = 고르기, 오른쪽·Esc = 한 단계 뒤로 (개선판은 창 바깥 누르기도), 끌기·방향키 = 화면 이동, 창틀(기둥·띠) 클릭 = 그쪽으로 몇 칸 이동 (원작)
// 개선판만: 휠·핀치·+/− = 확대 (맵 창 안), Enter = 결정, E 턴 종료, T 위험 범위, M 미니맵, 터치 길게 누르기 = 정보 창
import { clickTile, endPlayerStep, goBack, hoverTile, restPrompt, toggleMinimap, toggleThreat } from './battle'
import { TH, TW } from './data'
import { dialogueOpen } from './dialogue'
import { canvas, clampCam, toTile, zoomAt } from './render'
import { FRAME, mapRect, toLogical, view } from './screen'
import { S } from './state'
import { enter, modalOpen } from './ui'

const remake = () => !S.ed.features.commandFirst

/** 창틀 클릭 스크롤 (원작: 좌우 기둥·아래 띠, 위 띠는 맨 위라 미확인) */
function frameScroll(x: number, y: number) {
  const m = mapRect()
  if (x < FRAME.l) S.cam.x -= TW * 3
  else if (x >= m.x + m.w) S.cam.x += TW * 3
  else if (y < FRAME.t) S.cam.y -= TH * 2
  else if (y >= m.y + m.h) S.cam.y += TH * 2
  else return
  clampCam()
}

export function bindInput() {
  const pointers = new Map<number, { x: number; y: number }>()
  let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null
  let pinch: { d: number; z: number } | null = null
  let press = 0   // 터치 길게 누르기 타이머

  canvas.addEventListener('pointerdown', e => {
    if (!S.map || dialogueOpen()) return
    if (e.button === 2) { e.preventDefault(); goBack(); return }
    if (e.button !== 0) return
    canvas.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2 && remake()) {   // 두 손가락 = 확대
      const [a, b] = [...pointers.values()]
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: S.cam.scale }
      drag = null
      clearTimeout(press)
      return
    }
    drag = { x: e.clientX, y: e.clientY, cx: S.cam.x, cy: S.cam.y, moved: false }
    if (e.pointerType === 'touch' && remake()) {
      const p = toLogical(e.clientX, e.clientY)
      press = window.setTimeout(() => { if (drag && !drag.moved) { drag = null; hoverTile(toTile(p.x, p.y)) } }, 500)
    }
  })
  canvas.addEventListener('pointermove', e => {
    if (!S.map) return
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const mid = toLogical((a.x + b.x) / 2, (a.y + b.y) / 2)
      zoomAt(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, mid.x, mid.y)
      return
    }
    if (drag) {
      const dx = (e.clientX - drag.x) / view.s, dy = (e.clientY - drag.y) / view.s
      if (Math.abs(dx) + Math.abs(dy) > 6) { drag.moved = true; clearTimeout(press) }
      if (drag.moved) {
        S.cam.x = drag.cx - dx / S.cam.scale
        S.cam.y = drag.cy - dy / S.cam.scale
        clampCam()
      }
    }
    if (e.pointerType !== 'touch' && !modalOpen() && !dialogueOpen()) { const p = toLogical(e.clientX, e.clientY); hoverTile(toTile(p.x, p.y)) }
  })
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    clearTimeout(press)
    if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return }
    const d = drag
    drag = null
    if (!d || d.moved || e.button !== 0 || !S.map || dialogueOpen()) return
    const p = toLogical(e.clientX, e.clientY)
    // 개선판: 창 (명령·확인·메뉴·큰 상태창) 바깥을 누르면 그 창의 '뒤로' (오른쪽 클릭·Esc 와 같다)
    if (remake() && (modalOpen() || document.querySelector('.bigstat'))) { goBack(); return }
    const t = toTile(p.x, p.y)
    if (!t) { frameScroll(p.x, p.y); return }
    if (modalOpen()) return   // 원작 창은 모달: 창 밖 클릭 무시
    void clickTile(t).then(() => { if (e.pointerType !== 'touch') hoverTile(t) })
  }
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); pinch = null; drag = null })
  canvas.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') hoverTile(null) })
  canvas.addEventListener('contextmenu', e => e.preventDefault())
  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    if (!remake() || !S.map) return
    const p = toLogical(e.clientX, e.clientY)
    zoomAt(S.cam.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), p.x, p.y)
  }, { passive: false })

  addEventListener('keydown', e => {
    if (!S.map || dialogueOpen() || document.querySelector('#camp, #titlescreen:not([hidden]), #worldmap')) return
    const k = e.key.toLowerCase()
    const pan = 48 / S.cam.scale
    if (k === 'escape') goBack()
    else if (k === 'enter') { if (!enter()) return }
    else if (k === 'arrowleft' || k === 'a') S.cam.x -= pan
    else if (k === 'arrowright' || k === 'd') S.cam.x += pan
    else if (k === 'arrowup' || k === 'w') S.cam.y -= pan
    else if (k === 'arrowdown' || k === 's') S.cam.y += pan
    else if (k === 'e') remake() ? endPlayerStep() : restPrompt()
    else if (k === 't' && remake()) toggleThreat()
    else if (k === 'm' && remake()) toggleMinimap()
    else if ((k === '+' || k === '=') && remake()) zoomAt(S.cam.scale * 1.1)
    else if ((k === '-' || k === '_') && remake()) zoomAt(S.cam.scale / 1.1)
    else return
    e.preventDefault()
    clampCam()
  })
}
