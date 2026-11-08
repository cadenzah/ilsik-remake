// 정보 창: 작은 인물기본자료 (ECPBAS "basic", 원작 전투 중 유닛 클릭·상황), 승리·실패 조건 창 (원작 시스템 → 조건), GO!! GO!! 그림.
// 원작 작은 인물기본자료 (DOSBox u39): 제목 띠 그림에 「인물기본자료」, 아이콘 5개 (하트 생명·검 역량·날개방패 방어·회색 형상 [추정: 피로]·얼굴 = 큰 창)
// 아래에 수치. 개선판은 마우스를 올리면 이 창에 이름·지형 줄을 더해 띄운다 (ux-proposal.md 15)
import { terrainName } from './grid'
import { hud, mapRect, clampBox } from './screen'
import { pieceUrl } from './skin'
import { isNpc, member, S } from './state'
import type { Unit } from './unit'
import { closeWin, esc, openWin } from './ui'
import { winUrl } from './skin'
import { TW } from './data'
import { affIcons } from './affIcons'

const NARROW = 171, WIDE = 224   // 개선판 마우스 올림 창은 정보 줄 때문에 넓게 (지형·이동·사거리 줄이 잘리지 않게)

let basic: HTMLElement | null = null
/** 작은 인물기본자료. extra = 개선판 줄 (이름·지형). onFace = 얼굴 아이콘 (큰 창) */
export function showBasic(u: Unit | null, at?: { x: number; y: number }, opts: { extra?: boolean; onFace?: () => void } = {}) {
  basic?.remove()
  basic = null
  if (!u) return
  const next = opts.extra ? nextTurn(u) : ''
  // 상성 (개선판 B1 제안 25·25-2): 이름 줄 끝에 까닭만 아이콘으로 (종족·비행·시전 계열·중갑, core/affIcons.ts). 약점·내성 글은 쓰지 않는다 (2026-11-08 사용자: 과하게 친절)
  const race = opts.extra ? affIcons(S.ed.affinityMarks?.(u.type) ?? []) : ''
  const h = opts.extra ? 112 + (next ? 18 : 0) : 74, W = opts.extra ? WIDE : NARROW
  const el = document.createElement('div')
  el.className = `owin basic${opts.extra ? ' passive' : ''}`   // 개선판 마우스 올림 창은 입력을 가로채지 않는다
  Object.assign(el.style, { width: `${W}px`, height: `${h}px`, backgroundImage: `url(${winUrl('basic', W, h)})` })
  const vals = [u.hp, u.atk, u.def, u.fatigue]
  el.innerHTML = vals.map((v, i) => `<img class="ic" alt="" src="${pieceUrl(`icon.${i}.0`)}" style="left:${(W - NARROW) / 2 + 12 + i * 32}px">
      <span class="v${i === 3 && S.ed.id === 'remake' && v > 70 ? ' red' : ''}" style="left:${(W - NARROW) / 2 + 8 + i * 32}px">${String(v).padStart(2, '0')}</span>`).join('')
    + `<img class="ic face" alt="큰 창" src="${pieceUrl('icon.4.0')}" style="left:${(W - NARROW) / 2 + 12 + 4 * 32 + 2}px">`
    + (opts.extra ? `<div class="x"><b>${esc(u.type.name)}</b> Lv ${u.type.lv}${race}${u.side === 'ally' && u.troop !== 0 ? ' · NPC' : ''}${statusTags(u)}
        <br><span class="dim">${esc(terrainName(S.map, u.x, u.y))} · 이동 ${u.mov} · 사거리 ${u.range[1]}</span>${next ? `<br>${next}` : ''}</div>` : '')
  const face = el.querySelector<HTMLElement>('.face')!
  if (opts.onFace) { face.classList.add('btn'); face.onclick = e => { e.stopPropagation(); opts.onFace!() } }
  el.oncontextmenu = e => { e.preventDefault(); showBasic(null) }
  const m = mapRect()
  const p = at ? { x: at.x - (W - NARROW) / 2, y: at.y } : { x: m.x + 8, y: m.y + m.h - h - 8 }
  const c = clampBox(p.x, p.y, W, h)
  Object.assign(el.style, { left: `${c.x}px`, top: `${c.y}px` })
  hud.append(el)
  basic = el
}
export const hideBasic = () => showBasic(null)

/** 개선판 줄 (B1 N1): 컴퓨터 조종 유닛 — 경계 (상태 1) · 대기 (2) · 성향. 그 밖은 빈 줄 없음.
 *  쉬려는 적의 「다음 턴 휴식」 예고는 뺐다 (2026-11-08 사용자: 너무 친절함 — 피로·생명 수치를 보고 스스로 판단) */
function nextTurn(u: Unit) {
  if (u.hp <= 0 || !(u.side === 'enemy' || isNpc(u))) return ''
  const st = S.troopState[u.troop]
  if (st === 1) return '<span class="blue">경계</span>'
  if (st === 2) return '<span class="dim">대기</span>'
  const mind = S.ed.mindNote?.(u) ?? ''   // 개선판 성향 (B1 제안 10)
  return mind ? `<span class="dim">${mind}</span>` : ''
}

/** 개선판 줄: 상태 이상 (중독·혼수 남은 차례, 강화·약화) */
function statusTags(u: Unit) {
  const name = { atk: '역량', def: '방어', spi: '정신', agi: '민첩' } as const
  const tags = [
    ...u.poison > 0 ? [`<span class="red">중독${u.poison}</span>`] : [],
    ...u.coma > 0 ? [`<span class="blue">혼수${u.coma}</span>`] : [],
    ...u.guard ? ['<span class="blue">방어</span>'] : [],   // 방어 태세 (제안 27)
    ...(Object.keys(name) as (keyof typeof name)[]).filter(k => u.mods[k]).map(k => `${name[k]}${u.mods[k] > 0 ? '+' : ''}${u.mods[k]}`),
  ]
  return tags.length ? ` · ${tags.join(' ')}` : ''
}

/** 유닛 위쪽에 둘 자리 (가리지 않게: 위가 모자라면 아래) */
export function aboveUnit(sx: number, sy: number, h = 74) {
  const m = mapRect()
  const y = sy - h - 4 >= m.y ? sy - h - 4 : sy + 48 * S.cam.scale + 4
  return { x: sx + TW * S.cam.scale / 2 - NARROW / 2, y }
}

// ---------- 승리·실패 조건 ----------

/** 원작 조건 창 문구 (EXE DS:0xb55~: 적군전멸, ○○ 사망, 도착) [근사: 장별 원작 문구 대응 미추출, 지금 이름으로] */
export function conditions(orig = false): { win: string[]; lose: string[] } {
  const win: string[] = [], lose: string[] = []
  const name = (r: [number, number]) => member(r)?.type.name ?? '?'
  // 원작판: 원작 조건 창 (0aa2:225a) 문형 — 한 줄에 한 명 「X 사망」, 도착은 원작 장소 문구 (condText). 이름은 원작의 옛 번역 (에릭 등) 대신 지금 표기
  const each = (rs: [number, number][], tail: string) => orig ? [...new Set(rs.map(name))].map(n => `${n} ${tail}`) : [`${rs.map(name).join('·')} ${tail}`]
  for (const r of S.cond) {
    if (r.do.includes('lose') && 'dead' in r.if) lose.push(...each(r.if.dead, '사망'))
    else if ((r.do.includes('win') || r.do.includes('ending')) && 'reach' in r.if) win.push(orig ? S.condText?.win[0] ?? '목표 지점 도착' : '목표 지점 도착')
    else if ((r.do.includes('win') || r.do.includes('ending')) && 'dead' in r.if) win.push(...each(r.if.dead, orig ? '사망' : '쓰러뜨리기'))
  }
  if (!win.length) win.push('적군전멸')
  const lead = member([0, 0])
  if (lead && !lose.some(l => l.startsWith(lead.type.name))) lose.unshift(`${lead.type.name} 사망`)
  return { win, lose }
}

type Goal = { text: string; state: 'open' | 'done' | 'failed' }
/** 조건 창. title = 개선판 장 카드, goals = 개선판 목표·보조 목표, orig = 원작판 문형 (원작 0aa2:225a).
 *  개선판 도전 과제 (grade.ts)·장 환경은 여기 말고 위 띠 배지 (stageBadges.ts) */
export function showConditions(o: { title?: string; goal?: string; goals?: Goal[]; orig?: boolean; onClose?: () => void; button?: string } = {}) {
  const c = conditions(o.orig)
  const mark = { open: '◇', done: '✓', failed: '✗' }
  const body = [
    '<span class="h blue">승리조건</span>', ...(o.goal ? [esc(o.goal)] : c.win.map(esc)),
    '<span class="h red">실패조건</span>', ...c.lose.map(esc),
    ...(o.goals?.length ? ['<span class="h green">보조 목표</span>', ...o.goals.map(g => `<span class="${g.state}">${mark[g.state]} ${esc(g.text)}</span>`)] : []),
  ]
  const w = Math.min(mapRect().w - 16, Math.max(200, ...body.map(l => l.replace(/<[^>]+>/g, '').length * 16 + 40)))
  openWin({ title: o.title ?? '', body: body.join('<br>'), width: w, kind: 'cond', dir: 'row', at: 'center',
    buttons: [[o.button ?? '확인', () => o.onClose?.()]], onBack: () => { closeWin('cond'); o.onClose?.() }, x: false })
}

// ---------- GO!! GO!! (OTH 4) ----------

/** 전투 시작 (원작) · 아군 차례 시작 (개선판) 그림. 클릭하거나 ms 뒤 사라진다 (ms 없으면 클릭까지) */
export function goGo(ms?: number): Promise<void> {
  const m = mapRect()
  const img = document.createElement('img')
  img.className = 'gogo'
  img.src = pieceUrl('oth.4')
  Object.assign(img.style, { left: `${m.x + 8}px`, top: `${m.y + 8}px` })
  hud.append(img)
  return new Promise(ok => {
    let timer = 0
    const done = (e?: Event) => {
      e?.stopPropagation()   // 원작: 첫 클릭은 그림만 지운다
      clearTimeout(timer); img.remove(); removeEventListener('pointerdown', done, true); removeEventListener('keydown', done, true); ok()
    }
    if (ms) timer = window.setTimeout(done, ms)
    addEventListener('pointerdown', done, true)
    addEventListener('keydown', done, true)
  })
}


// ---------- Level Up (OTH 3) ----------

/** 레벨업 그림 (원작 20ec:0f92 모드 5): ECLIPSE.OTH 3 「Level Up」 (47×10) 을 칸 왼위 (+5, +36) 에서
 *  한 박자에 6px 씩 7단계로 (+5, 0) 까지 올리고 (단계마다 2틱 = step ms), 끝나면 지운다.
 *  웹은 글자가 작아 2배로 그리고 원작 그림의 가운데에 맞춘다 */
export function levelUpMark(sx: number, sy: number, step: number): Promise<void> {
  const img = document.createElement('img'), k = S.cam.scale, w = 47 * 2, h = 10 * 2
  img.className = 'gogo'
  img.src = pieceUrl('oth.3')
  const left = sx + (5 + 47 / 2) * k - w / 2, top = (dy: number) => sy + (dy + 5) * k - h / 2
  Object.assign(img.style, { left: `${left}px`, top: `${top(36)}px`, width: `${w}px` })
  hud.append(img)
  let i = 0
  return new Promise(ok => {
    const t = setInterval(() => {
      if (++i < 7) { img.style.top = `${top(36 - 6 * i)}px`; return }
      clearInterval(t); img.remove(); ok()
    }, step)
  })
}
