// 캔버스 렌더와 카메라. 캔버스는 창 전체 (장치 픽셀), 그림은 논리 좌표 (screen.ts) 로 그린다.
// 원작 전투 부품 (ux.md 1절): 이동 범위 = 범위 밖 칸에 STA 5 체크무늬, 공격 범위 = 화면을 보랏빛으로 어둡게 + 사거리 칸만 원래 색
// (사거리 1 이면 STA 3 십자 틀), 차례 유닛 = STA 1 모서리 괄호, 공격 대상 = STA 2 틀, 진영 표시 = 머리 위 STA 13·14·15
import { A, TH, TW } from './data'
import { attackSpots, dist, key, pathTo, reachable } from './grid'
import { frameImage, layout, mapRect, view } from './screen'
import { piece, size } from './skin'
import { alive, isNpc, S } from './state'
import { aiCaster, areaCells, inSpellRange, spellTargets, spellsOf } from './magic'
import type { Pos, Unit } from './unit'

export const canvas = document.getElementById('view') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

// 이동 프레임: 0~2 아래, 3~4 위, 5~6 왼쪽, 7~8 오른쪽
const FRAMES = { down: [0, 1, 2, 1], up: [3, 4], left: [5, 6], right: [7, 8] } as const

// 마법 이펙트 아틀라스 (export_web.py magic-fx): 56×96 칸 24열, 칸 = 원작 프레임 번호
const FX_W = 56, FX_H = 96, FX_COLS = 24
const fxImg = new Image()
fxImg.src = `${A}/ui/magic-fx.png`

// ---------- 카메라 (맵 픽셀, cam.scale = 확대) ----------

export function resize() {
  const dpr = devicePixelRatio || 1
  canvas.width = Math.round(innerWidth * dpr)
  canvas.height = Math.round(innerHeight * dpr)
  layout()
  clampCam()
}

const viewSize = () => { const m = mapRect(); return { vw: m.w / S.cam.scale, vh: m.h / S.cam.scale } }

export function clampCam() {
  if (!S.map) return
  const { vw, vh } = viewSize()
  const mw = S.map.w * TW, mh = S.map.h * TH
  S.cam.x = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, S.cam.x))
  S.cam.y = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, S.cam.y))
}

export function centerOn(p: Pos) {
  const { vw, vh } = viewSize()
  S.cam.x = p.x * TW + TW / 2 - vw / 2
  S.cam.y = p.y * TH + TH / 2 - vh / 2
  clampCam()
}

/** 확대 (개선판). 맵 창의 (lx, ly) 를 고정점으로 */
export function zoomAt(z: number, lx?: number, ly?: number) {
  const m = mapRect()
  const fx = (lx ?? m.x + m.w / 2) - m.x, fy = (ly ?? m.y + m.h / 2) - m.y
  const wx = S.cam.x + fx / S.cam.scale, wy = S.cam.y + fy / S.cam.scale
  S.cam.scale = Math.max(0.5, Math.min(1.5, z))
  S.cam.x = wx - fx / S.cam.scale
  S.cam.y = wy - fy / S.cam.scale
  clampCam()
}

/** 칸 왼쪽 위의 논리 좌표 */
export const toScreen = (x: number, y: number) => {
  const m = mapRect()
  return { sx: m.x + (x * TW - S.cam.x) * S.cam.scale, sy: m.y + (y * TH - S.cam.y) * S.cam.scale }
}
/** 논리 좌표 → 칸 (맵 창 밖·맵 밖이면 null) */
export function toTile(lx: number, ly: number): Pos | null {
  const m = mapRect()
  if (lx < m.x || ly < m.y || lx >= m.x + m.w || ly >= m.y + m.h) return null
  const x = Math.floor(((lx - m.x) / S.cam.scale + S.cam.x) / TW)
  const y = Math.floor(((ly - m.y) / S.cam.scale + S.cam.y) / TH)
  return x >= 0 && y >= 0 && x < S.map.w && y < S.map.h ? { x, y } : null
}

/** 칸이 맵 창 가장자리 밖이면 가운데로 */
export function centerOnIfOff(p: Pos) {
  const m = mapRect(), { sx, sy } = toScreen(p.x, p.y), cw = TW * S.cam.scale, ch = TH * S.cam.scale
  if (sx < m.x + cw / 2 || sy < m.y + ch / 2 || sx + cw > m.x + m.w - cw / 2 || sy + ch > m.y + m.h - ch / 2) centerOn(p)
}

// ---------- 렌더 ----------

/** 적 위협 범위 (개선판). only = 그 적만 */
function threatTiles(only?: Unit | null): Set<number> {
  const out = new Set<number>()
  for (const e of only ? [only] : alive('enemy')) {
    // 마법을 쓰는 적 (공격 유형 1) 은 쓸 수 있는 공격 마법의 사거리 + 범위까지
    const reach = Math.max(e.range[1], ...(aiCaster(e) ? spellsOf(e).filter(m => S.ed.rules.spellSide(m) === 'foe' && S.ed.rules.canCast(e, m)).map(m => m.range + m.area) : []))
    const lo = reach > e.range[1] ? 1 : e.range[0]
    for (const k of reachable(S.map, S.units, e).keys()) {
      const x = k % 1000, y = Math.floor(k / 1000)
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++) {
          const d = Math.abs(dx) + Math.abs(dy)
          if (d >= lo && d <= reach) out.add(key(x + dx, y + dy))
        }
    }
  }
  return out
}

// 위협 범위용 붉은 체크무늬 (STA 5 를 붉게)
let redDither: HTMLCanvasElement | null = null
function ditherRed() {
  if (!redDither) {
    const { w, h } = size('sta.5')
    redDither = document.createElement('canvas')
    redDither.width = w; redDither.height = h
    const c = redDither.getContext('2d')!
    piece(c, 'sta.5', 0, 0)
    c.globalCompositeOperation = 'source-in'
    c.fillStyle = '#c01818'
    c.fillRect(0, 0, w, h)
  }
  return redDither
}

const MARK = { ally: 'sta.13', npc: 'sta.14', enemy: 'sta.15' }

export function frame(now: number) {
  const dpr = devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, innerWidth, innerHeight)
  if (!S.map) { requestAnimationFrame(frame); return }
  ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.ox, dpr * view.oy)
  ctx.imageSmoothingEnabled = false
  const remake = !S.ed.features.commandFirst

  const m = mapRect(), sc = S.cam.scale
  ctx.save()
  ctx.beginPath()
  ctx.rect(m.x, m.y, m.w, m.h)
  ctx.clip()
  ctx.translate(m.x, m.y)
  ctx.scale(sc, sc)
  ctx.translate(-S.cam.x, -S.cam.y)

  // 타일
  const mp = S.map
  for (let y = 0; y < mp.h; y++)
    for (let x = 0; x < mp.w; x++) {
      const t = mp.tiles[y * mp.w + x]
      ctx.drawImage(S.atlas, (t % mp.atlasCols) * TW, Math.floor(t / mp.atlasCols) * TH, TW, TH, x * TW, y * TH, TW, TH)
    }

  const each = (f: (x: number, y: number) => void) => { for (let y = 0; y < mp.h; y++) for (let x = 0; x < mp.w; x++) f(x, y) }

  // 현대식 화면: 범위를 칸 칠하기로 (이동 파랑·공격 빨강), 원작 화면: 범위 밖 STA 5 체크무늬
  const modern = view.modern
  // 칸 칠하기 + 밝은 안쪽 테 (맵 색과 같은 계열이어도 — 파란 동굴의 이동 범위 등 — 칸이 보이게)
  const fill = (x: number, y: number, c: string, edge = 'rgba(255,248,220,0.75)') => {
    ctx.fillStyle = c; ctx.fillRect(x * TW + 1, y * TH + 1, TW - 2, TH - 2)
    ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.strokeRect(x * TW + 2.5, y * TH + 2.5, TW - 5, TH - 5)
  }

  if (remake && (S.threat || S.watch)) {
    const red = ditherRed()
    for (const k of threatTiles(S.threat ? null : S.watch))
      modern ? fill(k % 1000, Math.floor(k / 1000), 'rgba(200,40,16,0.30)', 'rgba(255,190,160,0.55)') : ctx.drawImage(red, (k % 1000) * TW, Math.floor(k / 1000) * TH)
  }

  const md = S.mode
  if (md.kind === 'selected') {
    if (modern) for (const k of md.moves.keys()) fill(k % 1000, Math.floor(k / 1000), 'rgba(60,70,240,0.38)', 'rgba(225,230,255,0.85)')
    else each((x, y) => { if (!md.moves.has(key(x, y))) piece(ctx, 'sta.5', x * TW, y * TH) })   // 범위 밖을 어둡게 (STA 5)
    if (S.ed.features.quickAttack)
      for (const e of alive('enemy')) if (attackSpots(md.unit, md.moves, e).length)
        modern ? fill(e.x, e.y, 'rgba(200,32,0,0.45)', 'rgba(255,200,170,0.9)') : piece(ctx, 'sta.2', e.x * TW, e.y * TH)
    if (remake && S.hover && md.moves.has(key(S.hover.x, S.hover.y))) {
      const path = pathTo(md.moves, S.hover.x, S.hover.y)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 4
      ctx.beginPath()
      path.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p.x * TW + TW / 2, p.y * TH + TH / 2))
      ctx.stroke()
    }
  }
  if (md.kind === 'targeting' && md.magic) {
    // 마법: 중심 칸 사거리 밖을 STA 5 로 (원작 모양 미확인 [근사]). 개선판은 가리킨 중심의 범위 칸과 듣는 대상을 밝게
    const u = md.unit, m = md.magic, own = S.ed.rules.spellSide(m) === 'own'
    if (modern) each((x, y) => { if (inSpellRange(S.ed.rules, m, u, { x, y })) fill(x, y, own ? 'rgba(40,170,90,0.30)' : 'rgba(200,32,0,0.32)', 'rgba(255,240,200,0.8)') })
    else each((x, y) => { if (!inSpellRange(S.ed.rules, m, u, { x, y })) piece(ctx, 'sta.5', x * TW, y * TH) })
    if (remake && S.hover && inSpellRange(S.ed.rules, m, u, S.hover)) {
      for (const c of areaCells(m, S.hover)) {
        ctx.fillStyle = 'rgba(255,200,40,0.45)'; ctx.fillRect(c.x * TW + 2, c.y * TH + 2, TW - 4, TH - 4)
        ctx.strokeStyle = 'rgba(255,250,210,0.9)'; ctx.lineWidth = 1.5; ctx.strokeRect(c.x * TW + 2.5, c.y * TH + 2.5, TW - 5, TH - 5)
      }
      ctx.strokeStyle = '#fff2a0'; ctx.lineWidth = 3
      for (const t of spellTargets(S.ed.rules, u, m, S.hover)) ctx.strokeRect(t.x * TW + 3, t.y * TH + 3, TW - 6, TH - 6)
    }
  } else if (md.kind === 'targeting') {
    // 사거리 밖을 이동 범위와 같은 STA 5 체크무늬로 (DOSBox a38: 보랏빛으로 보인 것은 축소 캡처의 착시), 사거리 1 이면 STA 3 십자 틀
    const u = md.unit
    if (modern) each((x, y) => { const d = dist(u, { x, y }); if (d >= u.range[0] && d <= u.range[1]) fill(x, y, 'rgba(200,32,0,0.32)', 'rgba(255,200,170,0.8)') })
    else {
      each((x, y) => { const d = dist(u, { x, y }); if (d < u.range[0] || d > u.range[1]) piece(ctx, 'sta.5', x * TW, y * TH) })
      if (u.range[0] === 1 && u.range[1] === 1) piece(ctx, 'sta.3', (u.x - 1) * TW, (u.y - 1) * TH)
    }
  }

  // 마법 연출 밑칠: 범위 칸을 계열 색으로 은은히 (웹 보탬 — 원작은 이펙트만)
  if (S.fx && now < S.fx.until) {
    const k = (now - S.fx.t0) / (S.fx.until - S.fx.t0)
    ctx.fillStyle = `rgba(${S.fx.color},${(0.35 * Math.sin(Math.PI * k)).toFixed(3)})`
    for (const c of S.fx.cells) ctx.fillRect(c.x * TW, c.y * TH, TW, TH)
  }

  // 유닛 (y 순으로 그려 겹침 자연스럽게)
  const sorted = S.units.filter(u => u.alpha > 0).sort((a, b) => a.py - b.py)
  const turnUnit = current()
  for (const u of sorted) {
    const x = u.px * TW, y = u.py * TH
    ctx.globalAlpha = u.alpha
    if (modern && S.marks) {   // 현대식: 발밑 진영 받침 (원작 화면은 머리 위 STA 13~15)
      ctx.fillStyle = isNpc(u) ? 'rgba(44,140,36,0.6)' : u.side === 'ally' ? 'rgba(42,47,216,0.6)' : 'rgba(200,32,0,0.6)'   // 원작 진영 색 (STA 13~15)
      ctx.beginPath()
      ctx.ellipse(x + TW / 2, y + TH - 6, 20, 6, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    const seq = FRAMES[u.facing]
    const moving = u.px !== u.x || u.py !== u.y
    const f = u.acted && u.side === 'ally' ? seq[0] : seq[Math.floor(now / (moving ? 120 : 380)) % seq.length]
    const img = S.sprites.get(u.type.id)
    if (img) {
      if (u.acted && u.side === 'ally') ctx.filter = 'grayscale(0.8) brightness(0.8)'
      ctx.drawImage(img, f * TW, 0, TW, TH, x, y - 4, TW, TH)
      ctx.filter = 'none'
    }
    if (u.flash > now && img) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.6
      ctx.drawImage(img, f * TW, 0, TW, TH, x, y - 4, TW, TH)
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.globalAlpha = u.alpha
    if (S.marks && !modern) piece(ctx, MARK[isNpc(u) ? 'npc' : u.side], x + 5, y + 2)
    if (remake) {   // 개선판: 생명 막대
      ctx.fillStyle = '#000a'
      ctx.fillRect(x + 8, y + TH - 4, TW - 16, 4)
      ctx.fillStyle = u.side === 'ally' ? '#55d17a' : '#ff6b6b'
      ctx.fillRect(x + 8, y + TH - 4, ((TW - 16) * u.hp) / u.maxHp, 4)
      statusDots(u, x, y)
    }
    ctx.globalAlpha = 1
  }
  if (modern) {   // 고른 유닛 = 금빛 테두리, 공격 대상 = 빨간 테두리
    if (turnUnit) { ctx.strokeStyle = `rgba(252,180,44,${0.6 + 0.4 * Math.sin(now / 180)})`; ctx.lineWidth = 3; ctx.strokeRect(turnUnit.px * TW + 2, turnUnit.py * TH + 2, TW - 4, TH - 4) }
    if (S.aim) { ctx.strokeStyle = '#e04020'; ctx.lineWidth = 3; ctx.strokeRect(S.aim.x * TW + 2, S.aim.y * TH + 2, TW - 4, TH - 4) }
  } else {
    if (turnUnit) piece(ctx, 'sta.1', turnUnit.px * TW, turnUnit.py * TH)
    if (S.aim) piece(ctx, 'sta.2', S.aim.x * TW, S.aim.y * TH)
  }

  // 가리킨 칸 (개선판만 — 원작은 마우스를 올려도 표시 없음)
  if (remake && S.hover && md.kind !== 'busy') {
    ctx.strokeStyle = 'rgba(255,226,138,.9)'
    ctx.lineWidth = 2
    ctx.strokeRect(S.hover.x * TW + 1, S.hover.y * TH + 1, TW - 2, TH - 2)
  }

  // 마법 이펙트 (원작 20ec:5c0f): 박자마다 다음 프레임. 범위 마법은 중심에서 한 칸 멀어질 때마다 한 박자 늦게.
  // 프레임 56×96 을 칸 위로 한 칸 걸쳐 그린다 (y − 48)
  if (S.fx && now < S.fx.until && fxImg.complete) {
    const beat = Math.floor((now - S.fx.t0) / S.fx.step)
    for (const c of S.fx.cells) {
      const n = beat - c.ring
      if (n < 0 || n > 5) continue
      const f = S.fx.base + n
      ctx.drawImage(fxImg, (f % FX_COLS) * FX_W, Math.floor(f / FX_COLS) * FX_H, FX_W, FX_H, c.x * TW, c.y * TH - (FX_H - TH), FX_W, FX_H)
    }
  }

  // 피해 숫자 (원작: 빨강)
  ctx.font = document.documentElement.classList.contains('bmfont') ? '32px "Eclipse Bitmap", sans-serif' : 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  S.floats = S.floats.filter(f => now - f.t0 < 900)
  for (const f of S.floats) {
    const k = (now - f.t0) / 900
    ctx.globalAlpha = 1 - k * k
    ctx.lineWidth = 4
    ctx.strokeStyle = '#000'
    ctx.strokeText(f.text, f.x * TW + TW / 2, f.y * TH - 20 * k)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x * TW + TW / 2, f.y * TH - 20 * k)
  }
  ctx.globalAlpha = 1
  ctx.restore()

  if (!view.modern) ctx.drawImage(frameImage(), 0, 0)
  for (const f of afterFrame) f(now)
  requestAnimationFrame(frame)
}

/** 개선판: 상태 이상 점 (중독 보라 · 혼수 파랑 · 강화 하늘 · 약화 주황), 생명 막대 위 오른쪽 */
function statusDots(u: Unit, x: number, y: number) {
  const mods = Object.values(u.mods)
  const dots = [u.poison > 0 && '#c070ff', u.coma > 0 && '#5aa8ff', mods.some(v => v > 0) && '#9ad8ff', mods.some(v => v < 0) && '#ff9a40'].filter(Boolean) as string[]
  dots.forEach((c, i) => {
    ctx.fillStyle = '#000'; ctx.fillRect(x + TW - 14 - i * 8, y + TH - 12, 7, 7)
    ctx.fillStyle = c; ctx.fillRect(x + TW - 13 - i * 8, y + TH - 11, 5, 5)
  })
}

/** 모서리 괄호를 둘 유닛: 원작판 = 지금 차례 유닛, 개선판 = 고른 유닛 */
function current(): Unit | null {
  const md = S.mode
  if (md.kind === 'selected' || md.kind === 'moved' || md.kind === 'targeting') return md.unit
  if (S.ed.features.commandFirst && md.kind === 'idle') return S.active.find(u => !u.acted && u.hp > 0) ?? null
  return null
}

/** 매 프레임 뒤에 부를 것 (미니맵) */
export const afterFrame: ((now: number) => void)[] = []
