// 대화창 — 원작 speak 창틀 (ECPSPE), 글자가 한 자씩 찍힌다 (ux.md 2절, ux-proposal.md 3·31).
// 원작판: 448×164 두 칸 (먼저 말한 사람 = 위 칸, 상대 = 아래 칸, 혼자면 위 칸만), 초상 왼쪽·이름 파랑·대사 3줄.
// 개선판: 맵 창 아래쪽에 낮은 두 칸 (위 칸 = 왼쪽 정렬·초상 왼쪽, 아래 칸 = 오른쪽 정렬·초상 오른쪽), 초상은 창 위로 조금 나온다.
//   지금 말하는 칸만 밝게. 혼자 말하는 장면은 아래 자리 하나.
// 조작: 클릭·Space·Enter = 이 쪽 다 보이기 → 다음, Ctrl 누르고 있기 = 빨리 넘김, Esc = 장면 넘기기.
//   클릭은 대화창과 맵 창 안만 (창틀 문양·화면 밖 띠는 무시, 2026-11-06)
// 초상: 장면을 열 때 모두 받아 두고, 아직 안 온 초상의 줄은 초상이 올 때까지 (최대 3초) 그 줄을 늦춘다 — 직전 화자 초상에 새 대사가 붙지 않게
// 대사는 talkLog 에 남는다 (장을 시작할 때 비움). 대화 중 띠의 「대화 기록」 = 대화 기록 창 (두 판, 웹 보탬, band.ts showTalkLog). 창이 떠 있는 동안 글자 찍기는 멈춘다
import { portraitUrl, type UnitType } from './data'
import { showTalkLog } from './band'
import { busy, imgLoaded, imgReady } from './loading'
import { hud, mapRect, onLayout, toLogical, view } from './screen'
import { back as winBack, closeWin, esc, modalOpen, openWin } from './ui'
import { winUrl } from './skin'

export interface Line { who?: UnitType; text: string }

const POR_W = 96, POR_H = 111
const SPEED = { original: 32, remake: 18 }   // 한 자 ms

type Slot = { el: HTMLElement; name: HTMLElement; text: HTMLElement; por: HTMLImageElement; who: number | null; porRight: boolean; remake: boolean }

function makeSlot(porRight: boolean, remake: boolean): Slot {
  const el = document.createElement('div')
  el.className = `speak${remake ? ' remake' : ''}${porRight ? ' right' : ''}`
  el.innerHTML = '<img class="por" alt=""><div class="name"></div><div class="text"></div>'
  hud.append(el)
  return { el, name: el.querySelector('.name')!, text: el.querySelector('.text')!, por: el.querySelector('.por')!, who: null, porRight, remake }
}

/** 칸 자리·크기 (논리 좌표). 화면 배치가 바뀌면 다시 부른다 */
function boxSlot(s: Slot, x: number, y: number, w: number, h: number) {
  const { remake, porRight } = s
  Object.assign(s.el.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, width: `${w}px`, height: `${h}px`, backgroundImage: `url(${winUrl('speak', w, h)})` })
  // 원작 배치 (w05): 초상 (20,30), 이름 (130,25), 대사 x 136, 줄 간격 20
  const textX = remake ? (porRight ? 24 : 20 + POR_W + 16) : 136
  Object.assign(s.por.style, { left: `${porRight ? w - 20 - POR_W : 20}px`, top: `${remake ? h - 16 - POR_H + 2 : 30}px` })
  Object.assign(s.name.style, { left: `${textX}px`, top: `${remake ? 16 : 25}px` })
  Object.assign(s.text.style, { left: `${textX}px`, top: `${remake ? 38 : 45}px`, width: `${w - (remake ? POR_W + 16 + 20 + 24 : 136 + 20)}px` })
}

// 대화 중 화면 배치가 바뀌면 (개선된 UI 켜고 끄기·창 크기) 칸을 지금 맵 창에 다시 둔다
let relayout: (() => void) | null = null
onLayout(() => relayout?.())

let playing = false
export const dialogueOpen = () => playing

/** 이 장에서 나온 대사 (name 없음 = 해설) */
export const talkLog: { name?: string; text: string }[] = []
export const resetTalkLog = () => { talkLog.length = 0 }

const PORTRAIT_WAIT = 3000

/** 대화 기록 창: 이 장에서 나온 대사, 차례대로 (최근 것이 아래, 열면 맨 아래). 닫기·Esc·바깥 누르기 = 닫고 대화로 */
export function talkLogWin() {
  // 두 칸: 이름 칸 (가장 긴 이름 폭) | 대사 칸 — 대사가 접혀도 대사 칸 안에서 들여 쓴다. 해설은 두 칸을 통째로
  const rows = talkLog.map(l => l.name ? `<span class="who blue">${esc(l.name)}</span><span class="say">${esc(l.text)}</span>` : `<span class="narr dim">${esc(l.text)}</span>`)
  const m = mapRect(), width = Math.min(m.w - 16, 520)
  const open = (bodyH?: number) => openWin({ title: '대화 기록', kind: 'talklog', at: 'center', width, dir: 'row', bodyH,
    body: `<div class="rules talklog">${rows.join('') || '<div class="dim">기록 없음</div>'}</div>`,
    buttons: [['닫기', () => {}]], onBack: () => closeWin('talklog'), x: false })
  let b = open().querySelector<HTMLElement>('.b')!
  if (b.scrollHeight !== b.clientHeight) b = open(Math.min(b.scrollHeight, m.h - 90)).querySelector<HTMLElement>('.b')!
  b.scrollTop = b.scrollHeight
}

/** 대화 재생. 끝나거나 Esc 로 넘기면 돌아온다 */
export function playDialogue(lines: Line[], edition: 'original' | 'remake' = view.wide ? 'remake' : 'original'): Promise<void> {
  if (!lines.length) return Promise.resolve()
  const remake = edition === 'remake'
  const ids = new Set(lines.map(l => l.who?.id ?? -1))
  const pair = ids.size > 1
  // 칸: 개선판 = 아래 칸 (혼자 말하면 이것만) + 위 칸, 원작판 = 위 칸 + 아래 칸
  const slots: Slot[] = remake ? (pair ? [makeSlot(false, true), makeSlot(true, true)] : [makeSlot(false, true)]) : (pair ? [makeSlot(false, false), makeSlot(false, false)] : [makeSlot(false, false)])
  const place = () => {
    const m = mapRect()
    if (remake) {
      const w = Math.min(m.w - 24, 560), h = 116
      const bx = pair ? m.x + m.w - w - 12 : m.x + (m.w - w) / 2, by = m.y + m.h - h - 8
      boxSlot(slots[slots.length - 1], bx, by, w, h)
      if (pair) boxSlot(slots[0], m.x + 12, by - h - 22, w, h)
    } else {
      const w = 448, h = 164, x = m.x + (m.w - w) / 2
      boxSlot(slots[0], x, m.y + 5, w, h)
      if (pair) boxSlot(slots[1], x, m.y + m.h - h - 11, w, h)
    }
  }
  place()
  relayout = place
  for (const s of slots) s.el.hidden = true
  playing = true
  for (const l of lines) if (l.who) void imgReady(portraitUrl(l.who.por))   // 장면의 초상을 한꺼번에 받기 시작
  showTalkLog(talkLogWin)

  return new Promise(done => {
    let i = 0, last = 0, fast = false, over = false, logged = 0
    // 지금 줄: 찍은 글자 수, 쪽이 넘쳐 기다리는 중, 다 찍음
    let cur: { s: Slot; chars: string[]; at: number; timer: number; wait: boolean; end: boolean } | null = null

    const finish = () => {
      if (cur) clearTimeout(cur.timer)
      cur = null
      for (const s of slots) s.el.remove()
      removeEventListener('keydown', onKey, true)
      removeEventListener('keyup', onKeyUp, true)
      removeEventListener('pointerdown', onPointer, true)
      for (const l of lines.slice(logged)) talkLog.push({ name: l.who?.name, text: l.text })   // Esc 로 넘긴 대사도 기록에
      over = true
      playing = false
      closeWin('talklog')
      showTalkLog(null)
      if (relayout === place) relayout = null
      done()
    }

    const show = () => {
      if (i >= lines.length) { finish(); return }
      const l = lines[i]
      const url = l.who ? portraitUrl(l.who.por) : ''
      if (url && !imgLoaded(url)) {   // 초상이 아직이면 올 때까지 이 줄을 늦춘다 (그동안 누르기는 cur 가 없어 무시)
        const at = i
        cur = null
        void busy(Promise.race([imgReady(url), new Promise(ok => setTimeout(ok, PORTRAIT_WAIT))])).then(() => { if (!over && i === at) present() })
        return
      }
      present()
    }
    const present = () => {
      const l = lines[i], id = l.who?.id ?? -1
      talkLog.push({ name: l.who?.name, text: l.text })
      logged = i + 1
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
      if (modalOpen()) { c.timer = window.setTimeout(step, 100); return }   // 기록·메뉴 창이 떠 있는 동안 멈춤
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
      const t = e.target as HTMLElement
      const onSpeak = !!t?.closest?.('.speak')
      if (!onSpeak && !t?.closest?.('#view')) return
      if (e.button === 2) return
      if (!onSpeak && !modalOpen()) {   // 맵 창 밖 (창틀 문양·화면 밖 띠) 은 넘기지 않는다. 창이 떠 있으면 어디든 창 닫기
        const p = toLogical(e.clientX, e.clientY), m = mapRect()
        if (p.x < m.x || p.y < m.y || p.x >= m.x + m.w || p.y >= m.y + m.h) return
      }
      e.preventDefault()
      e.stopPropagation()
      if (modalOpen()) { winBack(); return }   // 대화 중 띠 「메뉴」 로 연 창: 바깥을 누르면 창만 닫고 대화는 그대로
      advance()
    }
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen()) {   // 창이 떠 있으면 Esc = 창 닫기, Enter·Space = 창 버튼 (대화를 넘기지 않는다)
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); winBack() }
        return
      }
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
