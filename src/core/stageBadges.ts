// 개선판 전투 띠 배지 (2026-11-08 사용자: 도전 과제·장 환경을 목표 창에 끼워 두지 말고 더 잘 보이게).
//   도전 과제 = 별 셋 (◇ 아직 · ★ 해냄 · 흐린 별 놓침) — 누르면 지금 상태 창, 바뀌는 순간 맵 위쪽에 짧은 알림 (놓침·해냄·마지막 턴)
//   장 환경 = 아이콘 + 이름 — 누르면 규칙 창 (도움말 「장 환경」 으로), 장 시작 (목표 창 뒤) 에 맵 가운데 띠로 한 번 알린다
// 배지 자리는 band.ts setChips (원작 창틀 = 아래 띠 오른쪽, 현대식 = 위 바 턴 패 옆). 원작판은 아무것도 하지 않는다
import { affIcon } from './affIcons'
import { setChips, type BandChip } from './band'
import { stageTune } from './battleCore'
import type { StageEnv } from './data'
import { stageMarks, type Mark } from './grade'
import { rulesWin } from './help'
import { loadProgress } from './save'
import { hud, mapRect } from './screen'
import { S } from './state'
import { battleKnown } from './tips'
import { closeWin, esc, isOpen, openWin } from './ui'

const STAR = '<path d="M8 .9l2.1 4.6 5 .5-3.8 3.4 1.1 4.9L8 11.8l-4.4 2.5 1.1-4.9L.9 6l5-.5z"/>'
const star = (state: Mark['state']) => `<svg class="bstar ${state}" viewBox="0 0 16 16" aria-hidden="true">${STAR}</svg>`

/** 장 환경 아이콘 (affIcons 키). tune.json env.icon 이 있으면 그것, 없으면 규칙에서 짐작 */
function envIcon(e: StageEnv) {
  if (e.icon) return e.icon
  if (e.race) return 'undead'
  if (e.tire) return 'el4'
  const up = Object.entries(e.school ?? {}).find(([, k]) => k > 1)?.[0]
  return up ? `el${up}` : 'el8'
}

let timer = 0, lastStates: Mark['state'][] = [], warned = -1, sig = ''

/** 전투 시작: 배지를 만들고 상태를 지켜본다 (개선판만). 바뀐 상태는 알림으로 */
export function initBadges(on: boolean) {
  clearInterval(timer)
  lastStates = []; warned = -1; sig = ''
  if (!on) { setChips([]); return }
  refresh(true)
  timer = window.setInterval(() => { if (S.map) refresh(false) }, 300)
}

function refresh(first: boolean) {
  const marks = stageMarks(), env = stageTune()?.env
  const now = `${marks.map(m => m.state + m.text).join('|')}#${env?.name ?? ''}`
  if (now !== sig) {
    sig = now
    const chips: BandChip[] = []
    if (marks.length) chips.push({ id: 'marks', html: marks.map(m => star(m.state)).join(''), w: marks.length * 15 + 12,
      label: `도전 과제 ${marks.filter(m => m.state !== 'failed').length} / ${marks.length} 남음`, on: () => toggle('marks', marksWin) })
    if (env) chips.push({ id: 'env', html: `${affIcon(envIcon(env))}<span>${esc(env.name)}</span>`, short: affIcon(envIcon(env)),
      w: 16 + env.name.length * 13 + 16, label: `장 환경 · ${env.name}`, on: () => toggle('envwin', envWin) })
    setChips(chips)
    if (isOpen('marks')) marksWin()
  }
  if (!first) notify(marks)
  lastStates = marks.map(m => m.state)
}

/** 도전 과제가 바뀐 순간 알림: 놓침 (턴 넘김·쓰러짐) · 해냄 (보물) · 턴 제한의 마지막 턴 */
function notify(marks: Mark[]) {
  marks.forEach((m, i) => {
    const was = lastStates[i]
    if (!was || was === m.state) return
    const text = m.text.replace(/ \(\d+ \/ \d+\)$/, '')
    if (m.state === 'failed') toast(`${star('failed')} 도전 과제 놓침 · ${esc(text)}`, 'fail')
    else if (m.state === 'done') toast(`${star('done')} 도전 과제 해냄 · ${esc(text)}`, 'done')
  })
  const par = S.ed.par?.[`${S.def.n}-${S.def.route}`]
  if (par && S.turn === par && warned !== par && marks[0]?.state === 'open') {
    warned = par
    if (S.turn > 1) toast(`${star('open')} 이번 턴 안에 이기면 「${par}턴 안에 이긴다」`, 'warn')
  }
}

/** 맵 위쪽 가운데에 잠깐 뜨는 알림 (누르면 바로 사라진다). 여럿이면 아래로 쌓인다 */
export function toast(html: string, kind = '') {
  const m = mapRect()
  const el = document.createElement('div')
  el.className = `btoast ${kind}`
  el.innerHTML = html
  const stack = hud.querySelectorAll('.btoast').length
  Object.assign(el.style, { left: `${m.x + m.w / 2}px`, top: `${m.y + 10 + stack * 30}px` })
  el.onclick = e => { e.stopPropagation(); el.remove() }
  hud.append(el)
  setTimeout(() => el.classList.add('gone'), 2600)
  setTimeout(() => el.remove(), 3000)
}

/** 배지 누르기: 그 창이 떠 있으면 닫고, 아니면 다른 배지 창을 닫고 연다 (겹쳐 쌓이지 않게) */
function toggle(kind: 'marks' | 'envwin', open: () => void) {
  if (isOpen(kind)) { closeWin(kind); return }
  closeWin(kind === 'marks' ? 'envwin' : 'marks')
  open()
}

/** 도전 과제 창: 하나씩 지금 상태 + 턴 제한이면 남은 턴, 지난 최고 기록 */
function marksWin() {
  const marks = stageMarks()
  const par = S.ed.par?.[`${S.def.n}-${S.def.route}`]
  const best = loadProgress(S.ed.id)?.stars?.[`${S.def.n}-${S.def.route}`]
  const word = { open: '', done: ' <span class="green">해냄</span>', failed: ' <span class="dim">놓침</span>' }
  const lines = marks.map((m, i) => {
    const left = i === 0 && par && m.state === 'open' ? ` <span class="dim">· ${par - S.turn > 0 ? `${par - S.turn}턴 남음` : '이번 턴까지'}</span>` : ''
    return `<span class="bmark ${m.state}">${star(m.state)} ${esc(m.text)}${word[m.state]}${left}</span>`
  })
  const body = [...lines, ...best ? [`<span class="dim">지난 최고 ${'★'.repeat(best[0])}${'☆'.repeat(best[1] - best[0])}</span>`] : []]   // 「이긴 때 해낸 만큼 별」 설명은 뺐다 (자명, 2026-11-09 사용자)
  openWin({ title: '도전 과제', kind: 'marks', body: body.join('<br>'), width: Math.min(mapRect().w - 16, 320), fit: true, at: below('marks', 320),
    onBack: () => closeWin('marks'), modal: false })
}

/** 장 환경 창 */
function envWin() {
  const env = stageTune()?.env
  if (!env) return
  openWin({ title: `장 환경 · ${env.name}`, kind: 'envwin', width: Math.min(mapRect().w - 16, 300), fit: true, at: below('env', 300), dir: 'row',
    body: `${affIcon(envIcon(env))} ${esc(env.text)}`,   // 덧붙인 흐린 줄 (두 편 모두·확인창 안내) 은 뺐다 — 자명한 것 (2026-11-09 사용자: 과한 친절)
    buttons: [['도움말', () => rulesWin(battleKnown(), undefined, { topic: 'env', label: '닫기' })], ['닫기', () => {}]],
    onBack: () => closeWin('envwin'), modal: false })
}

/** 배지 쪽 맵 가장자리 자리 (창 너비 w): 위 바 배지면 맵 위쪽, 아래 띠 배지면 맵 아래쪽 (창은 맵 안으로 밀려 올라간다) */
function below(id: string, w: number) {
  const b = hud.querySelector<HTMLElement>(`.bchip[data-id="${id}"]`)
  const m = mapRect()
  if (!b || b.hidden) return { x: m.x + (m.w - w) / 2, y: m.y + 8 }
  const r = b.offsetLeft + b.offsetWidth / 2
  return { x: Math.max(m.x + 4, Math.min(m.x + m.w - w - 4, r - w / 2)), y: b.offsetTop > m.y + m.h / 2 ? m.y + m.h : m.y + 6 }
}

/** 장 시작 (목표 창 뒤): 맵 가운데 띠로 장 환경을 알린다. 누르거나 3.2초 뒤 사라지고, 배지가 잠깐 반짝인다 */
export function envBanner(): Promise<void> {
  const env = stageTune()?.env
  if (!env) return Promise.resolve()
  const m = mapRect()
  const el = document.createElement('div')
  el.className = 'benv'
  el.innerHTML = `<div class="k">장 환경</div><div class="n">${affIcon(envIcon(env))}${esc(env.name)}</div><div class="x">${esc(env.text)}</div>`
  Object.assign(el.style, { left: `${m.x}px`, top: `${m.y + m.h / 2 - 50}px`, width: `${m.w}px` })
  hud.append(el)
  return new Promise(ok => {
    let done = false
    const end = (e?: Event) => {
      if (done) return
      done = true
      e?.stopPropagation()
      removeEventListener('pointerdown', end, true); removeEventListener('keydown', end, true)
      el.classList.add('gone')
      setTimeout(() => el.remove(), 350)
      const chip = hud.querySelector<HTMLElement>('.bchip[data-id="env"]')
      chip?.classList.add('pulse')
      setTimeout(() => chip?.classList.remove('pulse'), 2400)
      ok()
    }
    setTimeout(end, 3200)
    setTimeout(() => { addEventListener('pointerdown', end, true); addEventListener('keydown', end, true) }, 250)   // 목표 창을 닫은 그 클릭은 넘긴다
  })
}
