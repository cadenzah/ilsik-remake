// 정비 화면 (출전 선택) — 원작 124e:8994 재현 (formats.md "정비 화면·출전 선택", DOSBox 대조 절)
// 화면 = 640×480 을 통째로 확대 (title.ts 와 같은 방식). 좌표는 모두 화면 좌표 (원작 창 안쪽 + (25,12)).
// 원작판: 원작 동작 그대로 — 처음엔 출전 줄이 비어 있고 ⟺ 를 눌러야 편성 (선두가 0번 칸), 대기 대원 클릭 = 끝에 붙임,
//   출전 j 번 클릭 = j 번부터 뒤가 모두 빠짐, 오른쪽 클릭·Esc = 편성 취소, 행동 = '여행계속' 확인 뒤 전투.
// 개선판: 같은 화면에서 바로 편성 (앞에서부터 채워 둠), 대원 하나씩 넣고 빼기, 마우스 올리면 능력치, 남은 칸 표시,
//   행동·Enter = '여행계속' 확인 뒤 전투 (확인창에서 Enter = 결정), ⟺ = 앞에서부터 다시 채우기, 장비 아이콘·버튼에 설명.
// 읽기·기록·음악은 웹판에 없어 도구설명 칸에 안내만, 종료 = '주화면' 확인 뒤 타이틀로 (두 판 같음)
// 개선판만: 음악 다음에 「설정」 (원작 버튼을 본뜬 camp-setting.png 를 종료 자리에, 종료는 한 칸 아래 camp-quit.png, export_web.py) → 원작 창틀 설정 창. '개선된 UI' 를 켜고 닫으면 현대식으로 다시 연다 (restyle)
// 현대식 (개선판 설정 modernUi): 다른 화면 (campModern.ts, ux-proposal.md 36). 여기 statusFrame 은 전투 중 큰 인물기본자료의 현대식 바탕
import { A, MAGIC_EFFECTS, STAT_NAMES, type Item, type Labels, type Tables, type UnitType } from './data'
import { hud, mapRect, view } from './screen'
import { winUrl } from './skin'
import { fadeIn, fadeOut } from './fade'
import { equippedStats } from './unit'
import { applyFont } from './font'
import { SETTINGS, setSetting, setting } from './settings'

/** battle: 출전 목록과 정비 화면에서 바꾼 소지품·일행 장비 (일행 인덱스 순) */
export type CampResult = { go: 'battle'; deploy: number[]; items: number[]; equip: UnitType['equip'][] } | { go: 'title' } | { go: 'load'; slot: number }
  | { go: 'restyle'; deploy: number[]; items: number[]; equip: UnitType['equip'][] }   // 현대식 설정에서 화면 모양을 바꿈 → 같은 편성으로 다시 연다

export interface CampOptions {
  party: UnitType[]   // 일행 (0번 = 선두, 뺄 수 없음)
  items: number[]     // 소지품 Item id
  tables: Tables
  max: number         // 출전 상한 (원작 8 하드코딩, 웹은 출전 칸 수로도 자름)
  remake: boolean
  initial: number[]   // 개선판이 처음 채워 둘 출전 목록 (일행 인덱스)
  /** 기록 3칸 (읽기·기록). list = 칸 이름 (빈 칸 null), save = 지금 정비 화면 상태를 그 칸에 */
  slots?: { list: () => (string | null)[]; save: (i: number, items: number[], equip: UnitType['equip'][]) => void }
  preview?: string    // 개선판: 도구설명 칸에 처음 보일 다음 장 이름·목표 (ux-proposal.md 23)
  modern?: boolean    // 현대식 화면 (campModern.ts)
  header?: { title: string; goal?: string }   // 현대식 위 바: 장 이름·목표
}

// 원작 좌표 (화면)
const WAIT = { x: 26, y: 376, dx: 47, dy: 46, cols: 7, w: 46, h: 39 }   // 대기 격자 BS 2, 7열 × 2줄
const SLOT = { x: 379, y: 370, dx: 57, dy: 50, cols: 4, w: 56, h: 48 }  // 출전 줄 BS 1, 4열 × 2줄
const ITEM = { x: 379, y: 115, dx: 51, dy: 57, cols: 3, per: 12 }        // 도구 목록 MAR/EQU 48×56, 3열 × 4줄
const BTN = { x: 571, w: 40, h: 24, read: 42, write: 77, music: 112, quit: 148, swap: 271, act: 305 }
const STEP = 35   // 명령 버튼 간격. 개선판은 종료 자리에 설정, 종료는 한 칸 아래
const TOOL = { x: 530, w: 18, trash: [128, 37], put: [192, 25], take: [238, 25] } as const   // 도구 옆 작은 아이콘 (원작 판정 범위)
const MINI = 29   // BS 얼굴 수 (유닛 0~28). 그 밖의 유닛은 이동 그림 첫 장으로

const PAGE_HELP = {
  intro: '대기인물 클릭: 출전\n출전인물 클릭: 빼기\n행동·Enter: 출발',
  read: '기록한 정비 화면을 불러온다.',
  write: '지금 정비 화면을 기록한다 (3칸).',
  music: '음악은 아직 없습니다.',
  swap: '출전 편성: 대기인물을 눌러 출전에 넣는다.',
  swapRemake: '앞에서부터 다시 채운다.',
  act: '출전인물로 전투를 시작한다.',
  quit: '타이틀(주화면)로 돌아간다.',
  settings: '글꼴·화면·편의 기능을 바꾼다.',
  trash: '고른 도구를 버린다.',
  put: '고른 도구를 지금 보이는 인물에게 장착한다.',
  take: '지금 보이는 인물의 도구를 풀어 소지품에 넣는다.',
}

/** 그 인물이 쓸 수 있는 도구인가 (원작 124e:9d1b): 공용(세부 30) 또는 인물의 도구 종류(+0x5c) 와 같은 세부. 지도 넷(175~178)은 안 됨 */
export const canEquip = (t: UnitType, it?: Item) =>
  !!it && it.cat === 2 && (it.id < 175 || it.id > 178) && (it.sub === 30 || it.sub === t.toolKind)

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)
const px = (x: number, y: number, w?: number, h?: number) =>
  `left:${x}px;top:${y}px${w ? `;width:${w}px` : ''}${h ? `;height:${h}px` : ''}`

export function sprite(t: UnitType, big: boolean) {
  const [w, h] = big ? [SLOT.w, SLOT.h] : [WAIT.w, WAIT.h]
  if (t.id < MINI) return `<i class="spr" style="width:${w}px;height:${h}px;background:url(${A}/ui/${big ? 'camp-face' : 'camp-mini'}.png) -${t.id * w}px 0"></i>`
  return `<i class="spr" style="width:${w}px;height:${h}px;background:url(${A}/units/${String(t.id).padStart(3, '0')}.png) 0 0 / auto ${h}px no-repeat"></i>`
}
/** 인물기본자료 글자 (WIN 1 위, 화면 좌표 = 창 + (25,12)). cur = 전투 중 현재 생명·피로 */
export function statusMarkup(t: UnitType, tables: Tables, cur?: { hp: number; fatigue: number; atk?: number; def?: number; spi?: number; agi?: number }) {
  const st = equippedStats(t, tables.items)
  const p = profile(t, tables.labels)
  const row = (y: number, label: string, now: number, max: number) =>
    `<span class="num cur" style="${px(101, y, 40)}">${now}</span>` +   // '/' 는 WIN 1 그림에 있음
    `<span class="num" style="${px(155, y)}" aria-label="${label} 최대">${max}</span>`
  return `<span class="txt b" style="${px(221, 38)}">${esc(t.name)}</span>` +
    `<span class="txt" style="${px(221, 58)}">${esc(p.race)}</span>` +
    `<span class="txt" style="${px(221, 78)}">${esc(p.sex)}</span>` +
    `<span class="txt" style="${px(221, 98)}">${esc(p.job)}</span>` +
    `<span class="txt" style="${px(221, 119)}">${t.lv}</span>` +
    row(148, '생명', cur?.hp ?? st.maxHp, st.maxHp) + row(168, '역량', cur?.atk ?? st.atk, st.atk) + row(188, '방어', cur?.def ?? st.def, st.def) +
    row(208, '정신', cur?.spi ?? st.spi, st.spi) + row(228, '민첩', cur?.agi ?? st.agi, st.agi) +   // 전투 중 = 강화·약화 반영한 현재치
    `<span class="txt" style="${px(270, 147)}">${st.mov}</span>` +
    `<span class="txt b" style="${px(270, 167)}">${esc(p.move)}</span>` +
    `<span class="txt" style="${px(270, 187)}">${esc(p.rank)}</span>` +
    `<span class="txt" style="${px(270, 207)}">${cur?.fatigue ?? t.fatigue}</span>` +
    `<span class="txt" style="${px(270, 227)}">${t.exp}</span>` +
    t.equip.map((id, k) => id ? `<button class="eq" data-item="${id}" style="${px(35 + 51 * k, 275, 48, 56)}">${icon(id)}</button>` : '').join('') +
    t.magic.slice(0, 8).map((id, k) => `<button class="mg" data-magic="${id}" style="${px(213 + 34 * (k % 4), 255 + 41 * Math.floor(k / 4), 32, 40)};background-position:-${id * 32}px 0"
      aria-label="${esc(tables.magic.get(id)?.name ?? '')}"></button>`).join('')
}

// ---------- 현대식 큰 인물기본자료 바탕 (camp-status 그림 자리에 패널, 그림 속 글자는 라벨로) ----------

const panel = (x: number, y: number, w: number, h: number, title: string) =>
  `<div class="mpanel" style="${px(x, y, w, h)}"><b>${title}</b></div>`
const label = (x: number, y: number, w: number, text: string, cls = '') =>
  `<span class="mlabel ${cls}" style="${px(x, y, w)}">${text}</span>`

/** 인물기본자료 바탕 (330×330, camp-status 자리). 원작 그림 속 항목 이름·'/'·구분선을 글자로 */
function statusFrame(modern: boolean, x = 0, y = 0) {
  if (!modern) return `<img class="status-bg" src="${A}/ui/camp-status.png" alt="" style="${px(x, y)}">`
  const L = label   // 아래 좌표는 창 안 (330×330) 좌표
  return `<div class="mstatus" style="${px(x, y, 330, 330)}">${panel(0, 0, 330, 330, '인물기본자료')}` +
    `<i class="mpor" style="${px(7, 18, 98, 113)}"></i>` +
    ['이름', '종족', '성별', '직업', '등급'].map((t, i) => L(128, [26, 46, 66, 86, 107][i], 64, `${t}:`, 'r')).join('') +
    ['생명', '역량', '방어', '정신', '민첩'].map((t, i) => L(8, 136 + 20 * i, 48, `${t}:`) + L(118, 136 + 20 * i, 10, '/', 'dim')).join('') +
    ['이동력', '이동방식', '부하상태', '피로도', '경험치'].map((t, i) => L(164, 136 + 20 * i, 76, `${t}:`, 'r')).join('') +
    `<i class="mrule" style="${px(12, 236, 306, 1)}"></i>` +
    ['무기', '방어', '도구'].map((t, i) => L(10 + 51 * i, 245, 48, t, 'c')).join('') +
    L(166, 246, 16, '마', 'c') + L(166, 300, 16, '법', 'c') + `</div>`
}

/** 전투 중 큰 인물기본자료 (원작: 작은 창의 얼굴 아이콘). 정비 화면 상태창을 맵 창 가운데에. 클릭·오른쪽 클릭으로 닫는다 */
export function statusWindow(t: UnitType, tables: Tables, cur: Parameters<typeof statusMarkup>[2] & {}, onClose?: () => void) {
  document.querySelector('.bigstat')?.remove()
  const m = mapRect()
  const el = document.createElement('div')
  el.className = 'bigstat'
  Object.assign(el.style, { left: `${Math.round(m.x + (m.w - 330) / 2)}px`, top: `${Math.round(m.y + Math.max(0, (m.h - 330) / 2))}px` })
  el.classList.toggle('modern', view.modern)
  el.innerHTML = `${statusFrame(view.modern)}
    <i class="por" style="${px(8, 19, 96, 111)};background-position:-${(t.por % 12) * 96}px -${Math.floor(t.por / 12) * 111}px"></i>
    <div class="status" style="left:-25px;top:-12px">${statusMarkup(t, tables, cur)}</div>`
  const close = (e: Event) => { e.preventDefault(); e.stopPropagation(); el.remove(); onClose?.() }
  el.onclick = close
  el.oncontextmenu = close
  hud.append(el)
}

export const icon = (id: number) =>
  `<i class="icon" style="background-position:-${((id - 1) % 13) * 48}px -${Math.floor((id - 1) / 13) * 56}px"></i>`

export function campScreen(o: CampOptions): Promise<CampResult> {
  if (o.modern) return import('./campModern').then(m => m.campModern(o))
  const root = document.createElement('section')
  root.id = 'camp'
  if (o.remake) root.className = 'remake'
  root.innerHTML = `<div class="stage">
      <img class="bg" src="${A}/ui/camp-bg.png" alt="">${statusFrame(false, 25, 12)}
      <i class="por" style="${px(33, 31, 96, 111)}"></i>
      <div class="status"></div>
      <div class="desc" style="${px(383, 31, 203, 56)}"></div>
      <div class="items"></div>
      <div class="wait"></div>
      <div class="slots"></div>
      <div class="count" hidden></div>
      <button class="hit" data-b="read" style="${px(BTN.x, BTN.read, BTN.w, BTN.h)}" aria-label="읽기"></button>
      <button class="hit" data-b="write" style="${px(BTN.x, BTN.write, BTN.w, BTN.h)}" aria-label="기록"></button>
      <button class="hit" data-b="music" style="${px(BTN.x, BTN.music, BTN.w, BTN.h)}" aria-label="음악"></button>
      ${o.remake ? `<img class="setbtn" src="${A}/ui/camp-setting.png" alt="" style="${px(568, BTN.quit - 1, 46, 25)}">
      <img class="setbtn" src="${A}/ui/camp-quit.png" alt="" style="${px(568, BTN.quit - 1 + STEP, 46, 25)}">
      <button class="hit" data-b="settings" style="${px(BTN.x, BTN.quit, BTN.w, BTN.h)}" aria-label="설정"></button>` : ''}
      <button class="hit" data-b="quit" style="${px(BTN.x, BTN.quit + (o.remake ? STEP : 0), BTN.w, BTN.h)}" aria-label="종료"></button>
      <button class="hit" data-b="swap" style="${px(BTN.x, BTN.swap, BTN.w, BTN.h)}" aria-label="출전 편성"></button>
      <button class="hit" data-b="act" style="${px(BTN.x, BTN.act, BTN.w, BTN.h + 1)}" aria-label="행동"></button>
      <button class="hit" data-b="trash" style="${px(TOOL.x, TOOL.trash[0], TOOL.w, TOOL.trash[1])}" aria-label="버리기"></button>
      <button class="hit" data-b="put" style="${px(TOOL.x, TOOL.put[0], TOOL.w, TOOL.put[1])}" aria-label="장착"></button>
      <button class="hit" data-b="take" style="${px(TOOL.x, TOOL.take[0], TOOL.w, TOOL.take[1])}" aria-label="해제"></button>
      <button class="hit" data-b="up" style="${px(532, 294, 15, 18)}" aria-label="도구 앞 쪽"></button>
      <button class="hit" data-b="down" style="${px(532, 316, 15, 18)}" aria-label="도구 뒤 쪽"></button>
    </div>`
  document.body.append(root)
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!
  const stage = $('.stage'), status = $('.status'), por = $('.por'), desc = $('.desc')
  const waitBox = $('.wait'), slotBox = $('.slots'), itemBox = $('.items'), count = $('.count')

  const fit = () => stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / 640, innerHeight / 480)})`
  fit()
  addEventListener('resize', fit)

  // 정비 화면에서 고치는 사본 (원래 표·캠페인 상태는 전투로 갈 때만 바뀐다)
  const party = o.party.map(t => ({ ...t, equip: [...t.equip] as UnitType['equip'] }))
  const items = [...o.items]
  let picked: number | null = null   // 고른 소지품 칸 (원작 [bp-0xb7c], 없음 = 0x65)

  // 원작판: 처음엔 편성 아님 (출전 줄 빔). 개선판: 처음부터 편성, 앞에서부터 채워 둠
  let editing = o.remake
  let sel: number[] = o.remake ? [...o.initial] : []
  let shown = 0          // 인물기본자료에 보이는 일행 인덱스
  let page = 0
  let dialog: HTMLElement | null = null

  // ---- 인물기본자료 (원작 7c18 모드 1, WIN 1 위) ----
  const showStatus = (i: number) => {
    shown = i
    const t = party[i]
    por.style.backgroundPosition = `-${(t.por % 12) * 96}px -${Math.floor(t.por / 12) * 111}px`
    status.innerHTML = statusMarkup(t, o.tables)
    // 원작판은 장비 아이콘을 눌러도 반응 없음 (DOSBox 확인). 개선판은 설명
    if (o.remake) status.querySelectorAll<HTMLButtonElement>('.eq').forEach(b => {
      const show = () => describe(o.tables.items.get(Number(b.dataset.item)))
      b.onclick = show
      b.onmouseenter = show
    })
    if (o.remake) status.querySelectorAll<HTMLButtonElement>('.mg').forEach(b => {
      const show = () => describeMagic(Number(b.dataset.magic))
      b.onclick = show
      b.onmouseenter = show
    })
  }

  // ---- 도구설명 (358,19) ----
  const describe = (it?: Item) => {
    if (!it) { desc.innerHTML = ''; return }
    const fx = [it.stat, it.stat2].filter(([n, v]) => n && v).slice(0, 2).map(([n, v], k) => {
      const neg = n > 8
      return `<span class="txt" style="${px(72, 22 + 19 * k)}">${STAT_NAMES[neg ? n - 8 : n]}</span>` +
        `<span class="txt ${neg ? 'neg' : 'pos'}" style="${px(112, 22 + 19 * k)}">${neg ? '-' : '+'}</span>` +
        `<span class="txt" style="${px(130, 22 + 19 * k)}">${v}</span>`
    }).join('')
    desc.innerHTML = `<span class="ico" style="${px(17, 0, 48, 56)}">${icon(it.id)}</span>` +
      `<span class="txt b" style="${px(72, 3)}">${esc(it.name)}</span>${fx}`
  }
  const describeMagic = (id: number) => {
    const m = o.tables.magic.get(id)
    if (!m) return
    desc.innerHTML = `<span class="mgi" style="${px(25, 8, 32, 40)};background-position:-${id * 32}px 0"></span>` +
      `<span class="txt b" style="${px(72, 3)}">${esc(m.name)}</span>` +
      `<span class="txt" style="${px(72, 22)}">${MAGIC_EFFECTS[m.effect] ?? ''}</span>` +
      `<span class="txt" style="${px(72, 41)}">피로 +${m.fatigue}</span>`
  }
  // 칸은 3줄. 넘치면 자간·글자 크기를 조금씩 줄여 맞춘다 (다음 장 이름·목표처럼 길이가 장마다 다른 글)
  const say = (text: string) => {
    desc.innerHTML = `<p class="say">${esc(text)}</p>`
    const p = desc.firstElementChild as HTMLElement, size = parseFloat(getComputedStyle(p).fontSize)
    for (const [ls, k] of [[-1, 1], [-1, 0.875], [-1, 0.75]]) {
      if (p.scrollHeight <= p.clientHeight + 1) break
      p.style.letterSpacing = `${ls}px`
      p.style.fontSize = `${size * k}px`
    }
  }

  // ---- 도구 목록 12칸 ----
  const drawItems = () => {
    const pages = Math.max(1, Math.ceil(items.length / ITEM.per))
    page = Math.min(page, pages - 1)
    itemBox.innerHTML = items.slice(page * ITEM.per, (page + 1) * ITEM.per).map((id, k) =>
      `<button class="it" data-item="${id}" style="${px(ITEM.x + ITEM.dx * (k % ITEM.cols), ITEM.y + ITEM.dy * Math.floor(k / ITEM.cols), 48, 56)}"
        aria-label="${esc(o.tables.items.get(id)?.name ?? '')}">${icon(id)}</button>`).join('')
    itemBox.querySelectorAll<HTMLButtonElement>('.it').forEach((b, k) => {
      const show = () => describe(o.tables.items.get(Number(b.dataset.item)))
      b.classList.toggle('picked', picked === page * ITEM.per + k)
      b.onclick = () => { if (!dialog) pick(page * ITEM.per + k) }   // 원작: 고르고 설명, 못 쓰는 인물에 X
      if (o.remake) b.onmouseenter = () => { if (!dialog && picked === null) show() }
    })
  }

  // ---- 도구 고르기·버리기·장착·해제 (원작 124e:9a5b·9e4f·9f85) ----
  const pickedItem = () => picked === null ? undefined : o.tables.items.get(items[picked])
  const pick = (k: number | null) => {
    picked = k
    if (k === null) desc.innerHTML = ''
    else describe(pickedItem())
    drawItems()
    draw()
  }
  const trash = () => {
    if (picked === null) return   // 원작: 고른 도구가 없으면 무시
    confirm('제거', TOOL.trash[0], () => { items.splice(picked!, 1); pick(null) }, 390)
  }
  const put = () => {
    const t = party[shown]
    if (picked === null || !canEquip(t, pickedItem())) return
    const old = t.equip[2]
    t.equip[2] = items[picked]
    if (old) items[picked] = old    // 맞바꿈: 옛 도구가 고른 칸 자리로
    else items.splice(picked, 1)
    showStatus(shown)
    pick(null)
  }
  const take = () => {
    const t = party[shown]
    if (!t.equip[2]) return
    items.push(t.equip[2])          // 목록 끝에 붙인다
    t.equip[2] = 0
    showStatus(shown)
    pick(null)
  }

  // ---- 대기 격자·출전 줄 ----
  const draw = () => {
    waitBox.innerHTML = party.map((t, i) => {
      const c = i % WAIT.cols, r = Math.floor(i / WAIT.cols)
      const gone = editing && sel.includes(i)   // 출전에 뽑힌 대원 칸은 지움 (원작 BS 0 조각)
      const full = editing && !gone && sel.length >= o.max
      return `<button class="mb ${gone ? 'gone' : ''} ${full ? 'full' : ''} ${i === shown ? 'shown' : ''}" data-i="${i}"
        style="${px(WAIT.x + WAIT.dx * c, WAIT.y + WAIT.dy * r, WAIT.w, WAIT.h)}" aria-label="${esc(t.name)}">${gone ? '' : sprite(t, false)}${
        !gone && picked !== null && !canEquip(t, pickedItem()) ? `<img class="x" src="${A}/ui/camp-x.png" alt="장착 불가">` : ''}</button>`
    }).join('')
    const slots = o.remake ? o.max : sel.length
    slotBox.innerHTML = Array.from({ length: slots }, (_, j) => {
      const i = sel[j], c = j % SLOT.cols, r = Math.floor(j / SLOT.cols)
      const style = px(SLOT.x + SLOT.dx * c, SLOT.y + SLOT.dy * r, SLOT.w, SLOT.h)
      if (i === undefined) return `<span class="empty" style="${style}"></span>`
      return `<button class="sb ${j === 0 ? 'lead' : ''}" data-j="${j}" style="${style}" aria-label="${esc(party[i].name)}">${sprite(party[i], true)}</button>`
    }).join('')
    root.classList.toggle('editing', editing)
    count.hidden = !o.remake
    count.textContent = `${sel.length} / ${o.max}`

    waitBox.querySelectorAll<HTMLButtonElement>('.mb').forEach(b => {
      const i = Number(b.dataset.i)
      b.onclick = () => {
        if (dialog) return
        if (!editing) { showStatus(i); draw(); return }
        if (!sel.includes(i) && sel.length < o.max) { sel.push(i); draw() }
        showStatus(i)
      }
      if (o.remake) b.onmouseenter = () => { if (!dialog && picked === null) showStatus(i) }   // 도구를 고른 동안엔 장착 대상이 흔들리지 않게
    })
    slotBox.querySelectorAll<HTMLButtonElement>('.sb').forEach(b => {
      const j = Number(b.dataset.j)
      b.onclick = () => {
        if (dialog || j === 0) return   // 선두는 뺄 수 없다
        if (o.remake) sel.splice(j, 1)  // 개선판: 그 대원만
        else sel.length = j             // 원작: j 번부터 뒤가 모두 빠짐
        draw()
      }
      if (o.remake) {
        b.onmouseenter = () => { if (!dialog) showStatus(sel[j]) }
        b.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); b.click() }
      }
    })
  }

  // ---- 확인창 (원작 0aa2:0c58, 화면 좌표) ----
  const confirm = (title: string, y: number, ok: () => void, x = 500) => {
    dialog = document.createElement('div')
    dialog.className = 'dlg owin'
    dialog.style.cssText = px(x, y, 136, 66) + `;background-image:url(${winUrl('comma', 136, 66)})`
    dialog.innerHTML = `<div class="t">${title}</div><button class="ok obtn">결정</button><button class="no obtn">취소</button>`
    stage.append(dialog)
    const close = () => { dialog?.remove(); dialog = null }
    dialog.querySelector<HTMLButtonElement>('.ok')!.onclick = () => { close(); ok() }
    dialog.querySelector<HTMLButtonElement>('.no')!.onclick = close
    dialog.querySelector<HTMLButtonElement>('.ok')!.focus()
  }

  /** 원작 「불러오기」·「자료저장」 창 (DOSBox c13·c14): 칸 이름 버튼 3개 (빈 칸 = 무기록) + 종료. needFull = 빈 칸은 못 고름 */
  const slotWin = (title: string, pick: (i: number) => void, needFull = false) => {
    const names = o.slots?.list() ?? []
    const w = 124, bw = 100, h = 25 + 5 + 4 * 29 - 4 + 5 + 9
    dialog = document.createElement('div')
    dialog.className = 'dlg owin slots'
    dialog.style.cssText = px(258, 150, w, h) + `;background-image:url(${winUrl('comma', w, h)})`
    dialog.innerHTML = `<div class="t">${title}</div>` + [0, 1, 2].map(i =>
      `<button class="obtn sl" data-i="${i}" style="${px((w - bw) / 2, 30 + i * 29, bw)}"${needFull && !names[i] ? ' disabled' : ''}>${esc(names[i] ?? '무기록')}</button>`).join('')
      + `<button class="obtn no" style="${px((w - bw) / 2, 30 + 3 * 29, bw)}">종료</button>`
    stage.append(dialog)
    const close = () => { dialog?.remove(); dialog = null }
    dialog.querySelectorAll<HTMLButtonElement>('.sl').forEach(b => { b.onclick = () => { close(); pick(Number(b.dataset.i)) } })
    dialog.querySelector<HTMLButtonElement>('.no')!.onclick = close
    dialog.querySelector<HTMLButtonElement>('.obtn:not(:disabled)')?.focus()
  }

  /** 개선판 「설정」 창 (원작 창틀·글자 버튼, slotWin 과 같은 모양): 항목마다 켬/끔, 올리면 도구설명 칸에 설명. 종료·Esc·오른쪽 클릭 = 닫기 */
  const settingsWin = (onClose: () => void, focus = 0) => {
    const w = 184, bw = 160, n = SETTINGS.length, h = 25 + 5 + (n + 1) * 29 - 4 + 5 + 9
    dialog?.remove()
    dialog = document.createElement('div')
    dialog.className = 'dlg owin slots opts'
    dialog.style.cssText = px((640 - w) / 2, 110, w, h) + `;background-image:url(${winUrl('comma', w, h)})`
    dialog.innerHTML = `<div class="t">설 정</div>` + SETTINGS.map((s, i) =>
      `<button class="obtn sl opt" data-i="${i}" role="switch" aria-checked="${setting(s.k)}" style="${px((w - bw) / 2, 30 + i * 29, bw)}">${esc(s.label)}<b>${setting(s.k) ? '켬' : '끔'}</b></button>`).join('')
      + `<button class="obtn no" style="${px((w - bw) / 2, 30 + n * 29, bw)}">종료</button>`
    stage.append(dialog)
    dialog.querySelectorAll<HTMLButtonElement>('.opt').forEach(b => {
      const s = SETTINGS[Number(b.dataset.i)]
      b.onclick = () => { setSetting(s.k, !setting(s.k)); if (s.k === 'bitmapFont') applyFont(); settingsWin(onClose, Number(b.dataset.i)) }
      b.onmouseenter = b.onfocus = () => say(s.title.replace(/^개선판: /, ''))
    })
    dialog.querySelector<HTMLButtonElement>('.no')!.onclick = () => { dialog?.remove(); dialog = null; onClose() }
    dialog.querySelectorAll<HTMLButtonElement>('.obtn')[focus]?.focus()
  }

  return new Promise(done => {
    const finish = (r: CampResult) => {
      removeEventListener('resize', fit)
      removeEventListener('keydown', onKey, true)
      if (r.go === 'title') { done(r); return }   // 타이틀로는 toTitle 이 어둡게 한 뒤 새로 불러온다
      void fadeOut().then(() => { root.remove(); done(r) })
    }
    const fight = () => finish({ go: 'battle', deploy: [...sel], items, equip: party.map(t => t.equip) })
    const act = () => {
      if (!sel.length) return   // 원작: 출전 수 0 이면 아무 반응 없음
      confirm('여행계속', 313, fight)   // 두 판 모두 확인 뒤 전투
    }
    const cancelEdit = () => {   // 원작 오른쪽 클릭: 편성 끝, 출전 줄 비움
      if (o.remake || !editing) return
      editing = false
      sel = []
      draw()
    }
    const buttons: Record<string, () => void> = {
      read: () => slotWin('불러오기', i => confirm('불러오기', 155, () => finish({ go: 'load', slot: i })), true),
      write: () => slotWin('자료저장', i => confirm('자료저장', 155, () => {
        o.slots?.save(i, [...items], party.map(t => t.equip))
        say('기록했습니다.')
      })),
      music: () => say(PAGE_HELP.music),
      quit: () => confirm('주화면', 155, () => finish({ go: 'title' })),
      settings: () => {
        const modern0 = setting('modernUi')
        settingsWin(() => { if (setting('modernUi') !== modern0) finish({ go: 'restyle', deploy: [...sel], items, equip: party.map(t => t.equip) }) })
      },
      swap: () => {
        if (o.remake) sel = [...o.initial]
        else { editing = true; sel = [0] }   // 원작: 누를 때마다 선두만으로 다시 시작
        draw()
      },
      act, trash, put, take,
      up: () => { if (page > 0) { page--; drawItems() } },
      down: () => { if ((page + 1) * ITEM.per < items.length) { page++; drawItems() } },
    }
    root.querySelectorAll<HTMLButtonElement>('.hit').forEach(b => {
      const k = b.dataset.b!
      b.onclick = () => { if (!dialog) buttons[k]() }
      if (o.remake) {
        const help = k === 'swap' ? PAGE_HELP.swapRemake : PAGE_HELP[k as keyof typeof PAGE_HELP]
        if (help) b.onmouseenter = () => { if (!dialog) say(help) }
      }
    })
    stage.oncontextmenu = e => { e.preventDefault(); if (dialog) dialog.querySelector<HTMLButtonElement>('.no')!.click(); else if (picked !== null) pick(null); else cancelEdit() }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); if (dialog) dialog.querySelector<HTMLButtonElement>('.no')!.click(); else if (picked !== null) pick(null); else cancelEdit() }
      else if (e.key === 'Enter' && o.remake && !dialog) { e.preventDefault(); act() }
    }
    addEventListener('keydown', onKey, true)

    showStatus(0)
    drawItems()
    draw()
    void fadeIn()
    if (o.remake) say(o.preview ?? PAGE_HELP.intro)
  })
}

/** 인물기본자료의 글자 항목. 직업·이동방식은 초상 97~99 이면 안 그림 (원작 7c18) */
export function profile(t: UnitType, L: Labels) {
  const hide = t.por >= 97 && t.por <= 99
  return { race: L.race[t.race] ?? '', sex: L.sex[t.sex] ?? '', job: hide ? '' : L.job[t.job] ?? '',
    move: hide ? '' : L.moveKind[t.moveKind] ?? '', rank: L.rank[t.rank] ?? '' }
}
