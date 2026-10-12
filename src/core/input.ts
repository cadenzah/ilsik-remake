// 마우스·키보드 입력
import { actionMenu, back, commandMenu, doAttack, endPlayerStep, restPrompt, select, toTitle, walk } from './battle'
import { attackSpots, dist, inRange, key, pathTo, terrainName } from './grid'
import { canvas, clampCam, toTile } from './render'
import { canCommand, S, unitAt } from './state'
import { showCard, showForecast, showResult, ui } from './ui'
import type { Pos } from './unit'

async function onClick(t: Pos) {
  const md = S.mode
  const there = unitAt(t.x, t.y)
  if (md.kind === 'busy') return
  if (md.kind === 'idle') {
    if (there && canCommand(there)) S.ed.features.commandFirst ? commandMenu(there) : select(there)
    return
  }
  if (md.kind === 'selected') {
    const u = md.unit
    if (there === u) { actionMenu(u, { x: u.x, y: u.y }); return }
    if (there && canCommand(there)) { select(there); return }
    if (there?.side === 'enemy' && S.ed.features.quickAttack) {
      // 이동 + 공격을 한 번에: 대상에 닿는 칸 중 가장 가까운 곳으로
      const spots = attackSpots(u, md.moves, there).sort((a, b) => dist(a, u) - dist(b, u))
      if (!spots.length) return
      const from = { x: u.x, y: u.y }
      S.mode = { kind: 'busy' }
      await walk(u, pathTo(md.moves, spots[0].x, spots[0].y))
      S.mode = { kind: 'targeting', unit: u, from }
      await doAttack(u, there)
      return
    }
    if (md.moves.has(key(t.x, t.y))) {
      const from = { x: u.x, y: u.y }
      S.mode = { kind: 'busy' }
      await walk(u, pathTo(md.moves, t.x, t.y))
      actionMenu(u, from)
      return
    }
    S.mode = { kind: 'idle' }
    return
  }
  if (md.kind === 'targeting') {
    if (there?.side === 'enemy' && inRange(md.unit, md.unit, there)) await doAttack(md.unit, there)
  }
}

function onHover(t: Pos | null, sx: number, sy: number) {
  S.hover = t
  if (!t) { showCard(null, null); showForecast(null, null); return }
  const there = unitAt(t.x, t.y)
  showCard(there ?? null, terrainName(S.map, t.x, t.y), S.tables)
  const md = S.mode
  const aim = S.ed.features.forecast && there?.side === 'enemy' && (
    (md.kind === 'selected' && attackSpots(md.unit, md.moves, there).length > 0) ||
    (md.kind === 'targeting' && inRange(md.unit, md.unit, there)))
  if (aim && (md.kind === 'selected' || md.kind === 'targeting')) {
    // 이동 전이면 한 번에 이동+공격이 설 칸 (가장 가까운 공격 칸) 의 지형으로
    const at = md.kind === 'selected' ? attackSpots(md.unit, md.moves, there).sort((a, b) => dist(a, md.unit) - dist(b, md.unit))[0] : md.unit
    showForecast(md.unit, there, S.ed.rules.damageRange(S.map, md.unit, there, at), sx, sy)
  }
  else showForecast(null, null)
}

function toggleThreat() {
  if (!S.ed.features.threat) return
  S.threat = !S.threat
  ui.btnThreat.classList.toggle('on', S.threat)
}

export function bindInput() {
  let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null
  canvas.addEventListener('pointerdown', e => {
    if (e.button === 2) { e.preventDefault(); back(); return }
    drag = { x: e.clientX, y: e.clientY, cx: S.cam.x, cy: S.cam.y, moved: false }
  })
  addEventListener('pointermove', e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true
      if (drag.moved) {
        S.cam.x = drag.cx - dx / S.cam.scale
        S.cam.y = drag.cy - dy / S.cam.scale
        clampCam()
      }
    }
    if (e.target === canvas && S.map) onHover(toTile(e.clientX, e.clientY), e.clientX, e.clientY)
  })
  addEventListener('pointerup', e => {
    const d = drag
    drag = null
    if (!d || d.moved || e.target !== canvas || e.button !== 0 || !S.map) return
    const t = toTile(e.clientX, e.clientY)
    if (t) void onClick(t).then(() => onHover(t, e.clientX, e.clientY))
  })
  canvas.addEventListener('contextmenu', e => e.preventDefault())
  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    S.cam.scale = Math.max(0.5, Math.min(2, S.cam.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
    clampCam()
  }, { passive: false })

  addEventListener('keydown', e => {
    if (!ui.dialogue.hidden || !ui.result.hidden || !S.map) return
    const k = e.key.toLowerCase()
    const pan = 48 / S.cam.scale
    if (k === 'escape') back()
    else if (k === 'e') S.ed.features.autoRest ? endPlayerStep() : restPrompt()
    else if (k === 't') toggleThreat()
    else if (k === 'arrowleft' || k === 'a') S.cam.x -= pan
    else if (k === 'arrowright' || k === 'd') S.cam.x += pan
    else if (k === 'arrowup' || k === 'w') S.cam.y -= pan
    else if (k === 'arrowdown' || k === 's') S.cam.y += pan
    else return
    clampCam()
  })

  ui.btnThreat.hidden = !S.ed.features.threat
  ui.btnThreat.onclick = toggleThreat
  ui.btnEnd.onclick = () => S.ed.features.autoRest ? endPlayerStep() : restPrompt()
  ui.btnTitle.onclick = () =>
    showResult('타이틀로', '진행 중인 전투는 저장되지 않습니다.', [['계속하기', () => {}], ['타이틀로', toTitle]])
  // 원작판은 한 명씩 움직이고, 움직이지 않고 차례를 넘기는 길은 휴식뿐 (원작 "휴식?" 확인)
  if (!S.ed.features.autoRest) {
    ui.btnEnd.innerHTML = '휴식 <kbd>E</kbd>'
    ui.btnEnd.title = '지금 유닛 휴식: 생명 회복하고 차례 끝 (E, Esc·우클릭도)'
  }
}
