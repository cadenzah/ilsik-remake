// 대화창 — 원작 speak 창틀 (ECPSPE), 글자가 한 자씩 찍힌다 (ux.md 2절, ux-proposal.md 3·31).
// 원작판: 448×164 두 칸 (먼저 말한 사람 = 위 칸, 상대 = 아래 칸, 혼자면 위 칸만), 초상 왼쪽·이름 파랑·대사 3줄.
// 개선판: 맵 창 아래쪽에 낮은 두 칸 (위 칸 = 왼쪽 정렬·초상 왼쪽, 아래 칸 = 오른쪽 정렬·초상 오른쪽), 초상은 창 위로 조금 나온다.
//   지금 말하는 칸만 밝게. 혼자 말하는 장면은 아래 자리 하나.
// 조작: 클릭·Space·Enter = 이 쪽 다 보이기 → 다음, Ctrl 누르고 있기 = 빨리 넘김, Esc = 장면 넘기기
import { portraitUrl, type UnitType } from './data'
import { hud, mapRect, view } from './screen'
import { esc } from './ui'
import { winUrl } from './skin'

export interface Line { who?: UnitType; text: string }

const POR_W = 96, POR_H = 111
const SPEED = { original: 32, remake: 18 }   // 한 자 ms

type Slot = { el: HTMLElement; name: HTMLElement; text: HTMLElement; por: HTMLImageElement; who: number | null }

function makeSlot(x: number, y: number, w: number, h: number, porRight: boolean, remake: boolean): Slot {
  const el = document.createElement('div')
  el.className = `speak${remake ? ' remake' : ''}${porRight ? ' right' : ''}`
  Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, backgroundImage: `url(${winUrl('speak', w, h)})` })
  // 원작 배치 (w05): 초상 (20,30), 이름 (130,25), 대사 x 136, 줄 간격 20
  const porY = remake ? h - 16 - POR_H + 2 : 30
  const porX = porRight ? w - 20 - POR_W : 20
  const textX = remake ? (porRight ? 24 : 20 + POR_W + 16) : 136
  const textW = w - (remake ? POR_W + 16 + 20 + 24 : 136 + 20)
  el.innerHTML = `<img class="por" alt="" style="left:${porX}px;top:${porY}px">
    <div class="name" style="left:${textX}px;top:${remake ? 16 : 25}px"></div>
    <div class="text" style="left:${textX}px;top:${remake ? 38 : 45}px;width:${textW}px"></div>`
  hud.append(el)
  return { el, name: el.querySelector('.name')!, text: el.querySelector('.text')!, por: el.querySelector('.por')!, who: null }
}

let playing = false
export const dialogueOpen = () => playing

/** 대화 재생. 끝나거나 Esc 로 넘기면 돌아온다 */
export function playDialogue(lines: Line[], edition: 'original' | 'remake' = view.wide ? 'remake' : 'original'): Promise<void> {
  if (!lines.length) return Promise.resolve()
  const remake = edition === 'remake'
  const m = mapRect()
  const ids = new Set(lines.map(l => l.who?.id ?? -1))
  const pair = ids.size > 1
  // 칸 자리
  let slots: Slot[]
  if (remake) {
    const w = Math.min(m.w - 24, 560), h = 116
    const bx = pair ? m.x + m.w - w - 12 : m.x + (m.w - w) / 2, by = m.y + m.h - h - 8
    const lower = makeSlot(Math.round(bx), by, w, h, pair, true)
    slots = pair ? [makeSlot(Math.round(m.x + 12), by - h - 22, w, h, false, true), lower] : [lower]
  } else {
    const w = 448, h = 164, x = Math.round(m.x + (m.w - w) / 2)
    slots = [makeSlot(x, m.y + 5, w, h, false, false)]
    if (pair) slots.push(makeSlot(x, m.y + m.h - h - 11, w, h, false, false))
  }
  for (const s of slots) s.el.hidden = true
  playing = true

  return new Promise(done => {
    let i = 0, last = 0, fast = false
    // 지금 줄: 찍은 글자 수, 쪽이 넘쳐 기다리는 중, 다 찍음
    let cur: { s: Slot; chars: string[]; at: number; timer: number; wait: boolean; end: boolean } | null = null

    const finish = () => {
      if (cur) clearTimeout(cur.timer)
      cur = null
      for (const s of slots) s.el.remove()
      removeEventListener('keydown', onKey, true)
      removeEventListener('keyup', onKeyUp, true)
      removeEventListener('pointerdown', onPointer, true)
      playing = false
      done()
    }

    const show = () => {
      if (i >= lines.length) { finish(); return }
      const l = lines[i], id = l.who?.id ?? -1
      // 칸 고르기: 이미 그 사람이 있는 칸 → 아니면 직전 화자가 아닌 칸
      let k = slots.findIndex(s => s.who === id)
      if (k < 0) k = slots.length > 1 && slots[last].who !== null ? 1 - last : last
      const s = slots[k]
      s.who = id
      last = k
      for (const o of slots) o.el.classList.toggle('dim', o !== s)
      s.el.hidden = false
      s.por.hidden = !l.who
      if (l.who) s.por.src = portraitUrl(l.who.por)
      s.el.classList.toggle('narr', !l.who)
      s.name.textContent = l.who?.name ?? ''
      s.text.innerHTML = ''
      cur = { s, chars: [...l.text], at: 0, timer: 0, wait: false, end: false }
      step()
    }

    /** 한 자 더. 칸을 넘치면 그 글자부터 다음 쪽 (wait) */
    const put = (c: NonNullable<typeof cur>): boolean => {
      if (c.at >= c.chars.length) { c.end = true; return false }
      const before = c.s.text.innerHTML
      c.s.text.innerHTML = before + esc(c.chars[c.at])
      if (c.s.text.scrollHeight > c.s.text.clientHeight + 1 && before) { c.s.text.innerHTML = before; c.wait = true; return false }
      c.at++
      return true
    }
    const step = () => {
      const c = cur
      if (!c) return
      if (put(c)) { c.timer = window.setTimeout(step, fast ? 0 : SPEED[edition]); return }
      if (fast) c.timer = window.setTimeout(advance, 60)
    }
    const advance = () => {
      const c = cur
      if (!c) return
      clearTimeout(c.timer)
      if (c.end) { i++; show() }
      else if (c.wait) { c.wait = false; c.s.text.innerHTML = ''; step() }
      else { while (put(c)); if (fast) c.timer = window.setTimeout(advance, 60) }   // 이 쪽 다 보이기
    }

    const onPointer = (e: PointerEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('.speak') && !(e.target as HTMLElement)?.closest?.('#view')) return
      if (e.button === 2) return
      e.preventDefault()
      e.stopPropagation()
      advance()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); advance() }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish() }
      else if (e.key === 'Control' && !fast && remake) { fast = true; advance() }
    }
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Control') fast = false }
    addEventListener('keydown', onKey, true)
    addEventListener('keyup', onKeyUp, true)
    addEventListener('pointerdown', onPointer, true)
    show()
  })
}
