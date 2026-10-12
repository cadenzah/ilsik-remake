// 캔버스 렌더와 카메라
import { TH, TW } from './data'
import { attackSpots, inRange, key, pathTo, reachable } from './grid'
import { alive, isNpc, S } from './state'
import type { Pos } from './unit'

export const canvas = document.getElementById('view') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

// 이동 프레임: 0~2 아래, 3~4 위, 5~6 왼쪽, 7~8 오른쪽
const FRAMES = { down: [0, 1, 2, 1], up: [3, 4], left: [5, 6], right: [7, 8] } as const

// ---------- 카메라 ----------

export function resize() {
  const dpr = devicePixelRatio || 1
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  const fit = Math.min(innerWidth / (S.map.w * TW), (innerHeight - 40) / (S.map.h * TH))
  S.cam.scale = Math.max(0.6, Math.min(1.5, fit < 1 ? Math.max(fit, 0.75) : 1))
  clampCam()
}

export function clampCam() {
  const vw = innerWidth / S.cam.scale, vh = (innerHeight - 40) / S.cam.scale
  const mw = S.map.w * TW, mh = S.map.h * TH
  S.cam.x = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, S.cam.x))
  S.cam.y = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, S.cam.y))
}

export function centerOn(p: Pos) {
  S.cam.x = p.x * TW + TW / 2 - innerWidth / S.cam.scale / 2
  S.cam.y = p.y * TH + TH / 2 - (innerHeight - 40) / S.cam.scale / 2
  clampCam()
}

export const toScreen = (x: number, y: number) => ({
  sx: (x * TW - S.cam.x) * S.cam.scale, sy: (y * TH - S.cam.y) * S.cam.scale + 40,
})
export function toTile(cx: number, cy: number): Pos | null {
  const x = Math.floor((cx / S.cam.scale + S.cam.x) / TW)
  const y = Math.floor(((cy - 40) / S.cam.scale + S.cam.y) / TH)
  return x >= 0 && y >= 0 && x < S.map.w && y < S.map.h ? { x, y } : null
}

// ---------- 렌더 ----------


function threatTiles(): Set<number> {
  const out = new Set<number>()
  for (const e of alive('enemy')) {
    for (const k of reachable(S.map, S.units, e).keys()) {
      const x = k % 1000, y = Math.floor(k / 1000)
      for (let dy = -e.range[1]; dy <= e.range[1]; dy++)
        for (let dx = -e.range[1]; dx <= e.range[1]; dx++) {
          const d = Math.abs(dx) + Math.abs(dy)
          if (d >= e.range[0] && d <= e.range[1]) out.add(key(x + dx, y + dy))
        }
    }
  }
  return out
}

export function frame(now: number) {
  const dpr = devicePixelRatio || 1
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#0d0f14'
  ctx.fillRect(0, 0, innerWidth, innerHeight)

  const sc = S.cam.scale
  ctx.save()
  ctx.translate(0, 40)
  ctx.scale(sc, sc)
  ctx.translate(-S.cam.x, -S.cam.y)

  // 타일
  const m = S.map
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const t = m.tiles[y * m.w + x]
      ctx.drawImage(S.atlas, (t % m.atlasCols) * TW, Math.floor(t / m.atlasCols) * TH, TW, TH, x * TW, y * TH, TW, TH)
    }

  // 격자
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 1 / sc
  ctx.beginPath()
  for (let x = 0; x <= m.w; x++) { ctx.moveTo(x * TW, 0); ctx.lineTo(x * TW, m.h * TH) }
  for (let y = 0; y <= m.h; y++) { ctx.moveTo(0, y * TH); ctx.lineTo(m.w * TW, y * TH) }
  ctx.stroke()

  const fill = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x * TW + 1, y * TH + 1, TW - 2, TH - 2) }

  if (S.threat) for (const k of threatTiles()) fill(k % 1000, Math.floor(k / 1000), 'rgba(255,50,50,0.32)')

  const md = S.mode
  if (md.kind === 'selected') {
    for (const k of md.moves.keys()) fill(k % 1000, Math.floor(k / 1000), 'rgba(80,140,255,0.38)')
    if (S.ed.features.quickAttack)
      for (const e of alive('enemy')) if (attackSpots(md.unit, md.moves, e).length) fill(e.x, e.y, 'rgba(255,70,70,0.45)')
    if (S.hover && md.moves.has(key(S.hover.x, S.hover.y))) {
      const path = pathTo(md.moves, S.hover.x, S.hover.y)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 4
      ctx.beginPath()
      path.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p.x * TW + TW / 2, p.y * TH + TH / 2))
      ctx.stroke()
    }
  }
  if (md.kind === 'targeting')
    for (const e of alive('enemy')) if (inRange(md.unit, md.unit, e)) fill(e.x, e.y, 'rgba(255,70,70,0.5)')

  // 유닛 (y 순으로 그려 겹침 자연스럽게)
  const sorted = S.units.filter(u => u.alpha > 0).sort((a, b) => a.py - b.py)
  for (const u of sorted) {
    const x = u.px * TW, y = u.py * TH
    ctx.globalAlpha = u.alpha
    // 진영 표시 받침
    ctx.fillStyle = isNpc(u) ? 'rgba(90,210,140,0.55)' : u.side === 'ally' ? 'rgba(79,140,255,0.55)' : 'rgba(255,90,90,0.55)'
    ctx.beginPath()
    ctx.ellipse(x + TW / 2, y + TH - 6, 20, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    const seq = FRAMES[u.facing]
    const moving = u.px !== u.x || u.py !== u.y
    const f = u.acted && u.side === 'ally' ? seq[0] : seq[Math.floor(now / (moving ? 120 : 380)) % seq.length]
    const img = S.sprites.get(u.type.id)
    if (img) {
      if (u.acted && u.side === 'ally') ctx.filter = 'grayscale(0.8) brightness(0.8)'
      ctx.drawImage(img, f * TW, 0, TW, TH, x, y - 4, TW, TH)
      ctx.filter = 'none'
    }
    if (u.flash > now) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.6
      ctx.drawImage(img!, f * TW, 0, TW, TH, x, y - 4, TW, TH)
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.globalAlpha = u.alpha
    // HP 막대
    ctx.fillStyle = '#000a'
    ctx.fillRect(x + 8, y + TH - 4, TW - 16, 4)
    ctx.fillStyle = u.side === 'ally' ? '#55d17a' : '#ff6b6b'
    ctx.fillRect(x + 8, y + TH - 4, ((TW - 16) * u.hp) / u.maxHp, 4)
    ctx.globalAlpha = 1
  }

  // 커서
  if (S.hover) {
    ctx.strokeStyle = '#ffe28a'
    ctx.lineWidth = 2
    ctx.strokeRect(S.hover.x * TW + 1, S.hover.y * TH + 1, TW - 2, TH - 2)
  }

  // 떠오르는 피해 숫자
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  S.floats = S.floats.filter(f => now - f.t0 < 900)
  for (const f of S.floats) {
    const k = (now - f.t0) / 900
    ctx.globalAlpha = 1 - k
    ctx.lineWidth = 4
    ctx.strokeStyle = '#000'
    ctx.strokeText(f.text, f.x * TW + TW / 2, f.y * TH - 20 * k)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, f.x * TW + TW / 2, f.y * TH - 20 * k)
  }
  ctx.globalAlpha = 1
  ctx.restore()
  requestAnimationFrame(frame)
}

export function centerOnIfOff(p: Pos) {
  const { sx, sy } = toScreen(p.x, p.y)
  if (sx < 60 || sy < 100 || sx > innerWidth - 120 || sy > innerHeight - 120) centerOn(p)
}
