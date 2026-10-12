// DOM 오버레이: 유닛 카드, 피해 예측, 행동 메뉴, 대화창, 알림
import { portraitUrl, type Tables, type UnitType } from './data'
import type { Unit } from './unit'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

export const ui = {
  title: $('title'), phase: $('phase'),
  btnEnd: $<HTMLButtonElement>('btn-end'), btnTitle: $<HTMLButtonElement>('btn-title'), btnThreat: $<HTMLButtonElement>('btn-threat'),
  card: $('card'), forecast: $('forecast'), menu: $('menu'), toast: $('toast'),
  dialogue: $('dialogue'), dlgPortrait: $<HTMLImageElement>('dlg-portrait'),
  dlgName: $('dlg-name'), dlgText: $('dlg-text'), result: $('result'),
}

/** 원작 표 기준 장비·마법 이름. 장비 능력치 보정은 spawn 때 반영됨 */
function loadout(u: Unit, t: Tables): string {
  const eq = u.type.equip.filter(id => id).map(id => t.items.get(id)?.name ?? `#${id}`)
  const mg = u.type.magic.map(id => t.magic.get(id)?.name ?? `#${id}`)
  const row = (label: string, xs: string[]) => xs.length ? `<div class="loadout"><span>${label}</span> ${xs.join(' · ')}</div>` : ''
  return row('장비', eq) + row('마법', mg)
}

export function showCard(u: Unit | null, terrain: string | null, t?: Tables) {
  if (!u && !terrain) { ui.card.hidden = true; return }
  ui.card.hidden = false
  const npc = !!u && u.side === 'ally' && u.troop !== 0   // 같은 편 NPC 부대, 컴퓨터 조종
  ui.card.className = u ? (npc ? 'npc' : u.side) : ''
  ui.card.innerHTML = u
    ? `<img src="${portraitUrl(u.type.por)}" alt="">
       <div>
         <div class="name">${u.type.name}<span class="lv">Lv ${u.type.lv}${npc ? ' · NPC (자동)' : ''}</span></div>
         <div class="bar"><i style="width:${(100 * u.hp) / u.maxHp}%"></i></div>
         <div style="font-size:13px">HP <b>${u.hp}</b> / ${u.maxHp}</div>
         <div class="stats"><span>역량 <b>${u.atk}</b></span><span>방어 <b>${u.def}</b></span><span>정신 <b>${u.spi}</b></span><span>민첩 <b>${u.agi}</b></span><span>이동 <b>${u.mov}</b></span><span>사거리 <b>${u.range[0] === u.range[1] ? u.range[0] : u.range.join('~')}</b></span></div>
         ${t ? loadout(u, t) : ''}
       </div>
       <div class="terrain">${terrain ?? ''}${u.acted ? ' · 행동 완료' : ''}</div>`
    : `<div class="terrain" style="border:0;padding:0">${terrain}</div>`
}

/** 피해 예측. range = 판 규칙의 피해 범위 */
export function showForecast(a: Unit | null, d: Unit | null, range: [number, number] = [0, 0], sx = 0, sy = 0) {
  if (!a || !d) { ui.forecast.hidden = true; return }
  const [lo, hi] = range
  const kill = lo >= d.hp ? '<div class="kill">확정 처치</div>' : hi >= d.hp ? '<div class="kill">처치 가능</div>' : ''
  ui.forecast.innerHTML = `<b>${a.type.name}</b> → <b>${d.type.name}</b><br>피해 ${lo}~${hi} (남은 HP ${Math.max(0, d.hp - hi)}~${Math.max(0, d.hp - lo)})${kill}`
  ui.forecast.hidden = false
  ui.forecast.style.left = `${sx + 18}px`
  ui.forecast.style.top = `${sy + 18}px`
}

export function showMenu(items: [string, () => void][], sx: number, sy: number) {
  ui.menu.innerHTML = ''
  for (const [label, fn] of items) {
    const b = document.createElement('button')
    b.textContent = label
    b.onclick = (e) => { e.stopPropagation(); fn() }
    ui.menu.append(b)
  }
  ui.menu.hidden = false
  ui.menu.style.left = `${Math.min(sx, innerWidth - 140)}px`
  ui.menu.style.top = `${Math.min(sy, innerHeight - 40 * items.length - 20)}px`
}
export const hideMenu = () => { ui.menu.hidden = true }

export function toast(text: string, cls: string, ms = 900): Promise<void> {
  ui.toast.textContent = text
  ui.toast.className = cls
  ui.toast.hidden = false
  return new Promise(ok => setTimeout(() => { ui.toast.hidden = true; ok() }, ms))
}

/** 대화 재생. 클릭/Space/Enter 로 진행, Esc 로 전부 건너뛰기. */
export function playDialogue(lines: { who?: UnitType; text: string }[]): Promise<void> {
  return new Promise(done => {
    let i = 0
    const show = () => {
      if (i >= lines.length) { finish(); return }
      const l = lines[i]
      ui.dlgPortrait.hidden = !l.who
      if (l.who) ui.dlgPortrait.src = portraitUrl(l.who.por)
      ui.dlgName.textContent = l.who?.name ?? ''
      ui.dlgText.textContent = l.text
    }
    const next = () => { i++; show() }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next() }
      else if (e.key === 'Escape') finish()
    }
    const finish = () => {
      ui.dialogue.hidden = true
      ui.dialogue.removeEventListener('click', next)
      removeEventListener('keydown', onKey, true)
      done()
    }
    ui.dialogue.hidden = false
    ui.dialogue.addEventListener('click', next)
    addEventListener('keydown', onKey, true)
    show()
  })
}

/** 결과·확인 화면. 버튼을 누르면 화면을 닫고 그 동작을 한다 */
export function showResult(title: string, body: string, buttons: [string, () => void][], note = '') {
  ui.result.innerHTML = `<h1>${title}</h1><div>${body}</div><div class="buttons"></div>${note ? `<div class="note">${note}</div>` : ''}`
  const row = ui.result.querySelector('.buttons')!
  for (const [label, fn] of buttons) {
    const b = document.createElement('button')
    b.textContent = label
    b.onclick = () => { ui.result.hidden = true; fn() }
    row.append(b)
  }
  ui.result.hidden = false
  ;(row.firstElementChild as HTMLElement | null)?.focus()
}
