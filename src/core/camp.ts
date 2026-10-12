// 정비 화면 (출전 선택) — 원작 124e:8994 재현 (formats.md "정비 화면·출전 선택", DOSBox 대조 절)
// 화면 = 640×480 을 통째로 확대 (title.ts 와 같은 방식). 좌표는 모두 화면 좌표 (원작 창 안쪽 + (25,12)).
// 원작판: 원작 동작 그대로 — 처음엔 출전 줄이 비어 있고 ⟺ 를 눌러야 편성 (선두가 0번 칸), 대기 대원 클릭 = 끝에 붙임,
//   출전 j 번 클릭 = j 번부터 뒤가 모두 빠짐, 오른쪽 클릭·Esc = 편성 취소, 행동 = '여행계속' 확인 뒤 전투.
// 개선판: 같은 화면에서 바로 편성 (앞에서부터 채워 둠), 대원 하나씩 넣고 빼기, 마우스 올리면 능력치, 남은 칸 표시,
//   행동·Enter = '여행계속' 확인 뒤 전투 (확인창에서 Enter = 결정), ⟺ = 앞에서부터 다시 채우기, 장비 아이콘·버튼에 설명.
// 읽기·기록·음악은 웹판에 없어 도구설명 칸에 안내만, 종료 = '주화면' 확인 뒤 타이틀로 (두 판 같음)
import { A, MAGIC_EFFECTS, STAT_NAMES, type Item, type Labels, type Tables, type UnitType } from './data'
import { fadeIn, fadeOut } from './fade'
import { equippedStats } from './unit'

export type CampResult = { go: 'battle'; deploy: number[] } | { go: 'title' }

export interface CampOptions {
  party: UnitType[]   // 일행 (0번 = 선두, 뺄 수 없음)
  items: number[]     // 소지품 Item id
  tables: Tables
  max: number         // 출전 상한 (원작 8 하드코딩, 웹은 출전 칸 수로도 자름)
  remake: boolean
  initial: number[]   // 개선판이 처음 채워 둘 출전 목록 (일행 인덱스)
}

// 원작 좌표 (화면)
const WAIT = { x: 26, y: 376, dx: 47, dy: 46, cols: 7, w: 46, h: 39 }   // 대기 격자 BS 2, 7열 × 2줄
const SLOT = { x: 379, y: 370, dx: 57, dy: 50, cols: 4, w: 56, h: 48 }  // 출전 줄 BS 1, 4열 × 2줄
const ITEM = { x: 379, y: 115, dx: 51, dy: 57, cols: 3, per: 12 }        // 도구 목록 MAR/EQU 48×56, 3열 × 4줄
const BTN = { x: 571, w: 40, h: 24, read: 42, write: 77, music: 112, quit: 148, swap: 271, act: 305 }
const MINI = 29   // BS 얼굴 수 (유닛 0~28). 그 밖의 유닛은 이동 그림 첫 장으로

const PAGE_HELP = {
  read: '장을 마칠 때마다 자동 기록. 이어하기는 타이틀의 지난흔적.',
  music: '음악은 아직 없습니다.',
  swap: '출전 편성: 대기인물을 눌러 출전에 넣는다.',
  swapRemake: '앞에서부터 다시 채운다.',
  act: '출전인물로 전투를 시작한다.',
  quit: '타이틀(주화면)로 돌아간다.',
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)
const px = (x: number, y: number, w?: number, h?: number) =>
  `left:${x}px;top:${y}px${w ? `;width:${w}px` : ''}${h ? `;height:${h}px` : ''}`

function sprite(t: UnitType, big: boolean) {
  const [w, h] = big ? [SLOT.w, SLOT.h] : [WAIT.w, WAIT.h]
  if (t.id < MINI) return `<i class="spr" style="width:${w}px;height:${h}px;background:url(${A}/ui/${big ? 'camp-face' : 'camp-mini'}.png) -${t.id * w}px 0"></i>`
  return `<i class="spr" style="width:${w}px;height:${h}px;background:url(${A}/units/${String(t.id).padStart(3, '0')}.png) 0 0 / auto ${h}px no-repeat"></i>`
}
const icon = (id: number) =>
  `<i class="icon" style="background-position:-${((id - 1) % 13) * 48}px -${Math.floor((id - 1) / 13) * 56}px"></i>`

export function campScreen(o: CampOptions): Promise<CampResult> {
  const root = document.createElement('section')
  root.id = 'camp'
  if (o.remake) root.className = 'remake'
  root.innerHTML = `<div class="stage">
      <img class="bg" src="${A}/ui/camp-bg.png" alt="">
      <img class="status-bg" src="${A}/ui/camp-status.png" alt="" style="${px(25, 12)}">
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
      <button class="hit" data-b="quit" style="${px(BTN.x, BTN.quit, BTN.w, BTN.h)}" aria-label="종료"></button>
      <button class="hit" data-b="swap" style="${px(BTN.x, BTN.swap, BTN.w, BTN.h)}" aria-label="출전 편성"></button>
      <button class="hit" data-b="act" style="${px(BTN.x, BTN.act, BTN.w, BTN.h + 1)}" aria-label="행동"></button>
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

  // 원작판: 처음엔 편성 아님 (출전 줄 빔). 개선판: 처음부터 편성, 앞에서부터 채워 둠
  let editing = o.remake
  let sel: number[] = o.remake ? [...o.initial] : []
  let shown = 0          // 인물기본자료에 보이는 일행 인덱스
  let page = 0
  let dialog: HTMLElement | null = null

  // ---- 인물기본자료 (원작 7c18 모드 1, WIN 1 위) ----
  const showStatus = (i: number) => {
    shown = i
    const t = o.party[i], st = equippedStats(t, o.tables.items)
    por.style.backgroundPosition = `-${(t.por % 12) * 96}px -${Math.floor(t.por / 12) * 111}px`
    const p = profile(t, o.tables.labels)
    const row = (y: number, label: string, cur: number, max: number) =>
      `<span class="num cur" style="${px(101, y, 40)}">${cur}</span>` +   // '/' 는 WIN 1 그림에 있음
      `<span class="num" style="${px(155, y)}" aria-label="${label} 최대">${max}</span>`
    status.innerHTML =
      `<span class="txt b" style="${px(221, 38)}">${esc(t.name)}</span>` +
      `<span class="txt" style="${px(221, 58)}">${esc(p.race)}</span>` +
      `<span class="txt" style="${px(221, 78)}">${esc(p.sex)}</span>` +
      `<span class="txt" style="${px(221, 98)}">${esc(p.job)}</span>` +
      `<span class="txt" style="${px(221, 119)}">${t.lv}</span>` +
      row(148, '생명', st.maxHp, st.maxHp) + row(168, '역량', st.atk, st.atk) + row(188, '방어', st.def, st.def) +
      row(208, '정신', st.spi, st.spi) + row(228, '민첩', st.agi, st.agi) +
      `<span class="txt" style="${px(270, 147)}">${st.mov}</span>` +
      `<span class="txt b" style="${px(270, 167)}">${esc(p.move)}</span>` +
      `<span class="txt" style="${px(270, 187)}">${esc(p.rank)}</span>` +
      `<span class="txt" style="${px(270, 207)}">${t.fatigue}</span>` +
      `<span class="txt" style="${px(270, 227)}">${t.exp}</span>` +
      t.equip.map((id, k) => id ? `<button class="eq" data-item="${id}" style="${px(35 + 51 * k, 275, 48, 56)}">${icon(id)}</button>` : '').join('') +
      t.magic.slice(0, 8).map((id, k) => `<button class="mg" data-magic="${id}" style="${px(213 + 34 * (k % 4), 255 + 41 * Math.floor(k / 4), 32, 40)};background-position:-${id * 32}px 0"
        aria-label="${esc(o.tables.magic.get(id)?.name ?? '')}"></button>`).join('')
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
  const say = (text: string) => { desc.innerHTML = `<p class="say">${esc(text)}</p>` }

  // ---- 도구 목록 12칸 ----
  const drawItems = () => {
    const pages = Math.max(1, Math.ceil(o.items.length / ITEM.per))
    page = Math.min(page, pages - 1)
    itemBox.innerHTML = o.items.slice(page * ITEM.per, (page + 1) * ITEM.per).map((id, k) =>
      `<button class="it" data-item="${id}" style="${px(ITEM.x + ITEM.dx * (k % ITEM.cols), ITEM.y + ITEM.dy * Math.floor(k / ITEM.cols), 48, 56)}"
        aria-label="${esc(o.tables.items.get(id)?.name ?? '')}">${icon(id)}</button>`).join('')
    itemBox.querySelectorAll<HTMLButtonElement>('.it').forEach(b => {
      const show = () => describe(o.tables.items.get(Number(b.dataset.item)))
      b.onclick = show
      if (o.remake) b.onmouseenter = show
    })
  }

  // ---- 대기 격자·출전 줄 ----
  const draw = () => {
    waitBox.innerHTML = o.party.map((t, i) => {
      const c = i % WAIT.cols, r = Math.floor(i / WAIT.cols)
      const gone = editing && sel.includes(i)   // 출전에 뽑힌 대원 칸은 지움 (원작 BS 0 조각)
      const full = editing && !gone && sel.length >= o.max
      return `<button class="mb ${gone ? 'gone' : ''} ${full ? 'full' : ''} ${i === shown ? 'shown' : ''}" data-i="${i}"
        style="${px(WAIT.x + WAIT.dx * c, WAIT.y + WAIT.dy * r, WAIT.w, WAIT.h)}" aria-label="${esc(t.name)}">${gone ? '' : sprite(t, false)}</button>`
    }).join('')
    const slots = o.remake ? o.max : sel.length
    slotBox.innerHTML = Array.from({ length: slots }, (_, j) => {
      const i = sel[j], c = j % SLOT.cols, r = Math.floor(j / SLOT.cols)
      const style = px(SLOT.x + SLOT.dx * c, SLOT.y + SLOT.dy * r, SLOT.w, SLOT.h)
      if (i === undefined) return `<span class="empty" style="${style}"></span>`
      return `<button class="sb ${j === 0 ? 'lead' : ''}" data-j="${j}" style="${style}" aria-label="${esc(o.party[i].name)}">${sprite(o.party[i], true)}</button>`
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
      if (o.remake) b.onmouseenter = () => { if (!dialog) showStatus(i) }
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
  const confirm = (title: string, y: number, ok: () => void) => {
    dialog = document.createElement('div')
    dialog.className = 'dlg'
    dialog.style.cssText = px(500, y, 136, 66)
    dialog.innerHTML = `<div class="t">${title}</div><button class="ok">결정</button><button class="no">취소</button>`
    stage.append(dialog)
    const close = () => { dialog?.remove(); dialog = null }
    dialog.querySelector<HTMLButtonElement>('.ok')!.onclick = () => { close(); ok() }
    dialog.querySelector<HTMLButtonElement>('.no')!.onclick = close
    dialog.querySelector<HTMLButtonElement>('.ok')!.focus()
  }

  return new Promise(done => {
    const finish = (r: CampResult) => {
      removeEventListener('resize', fit)
      removeEventListener('keydown', onKey, true)
      if (r.go === 'title') { done(r); return }   // 타이틀로는 toTitle 이 어둡게 한 뒤 새로 불러온다
      void fadeOut().then(() => { root.remove(); done(r) })
    }
    const fight = () => finish({ go: 'battle', deploy: [...sel] })
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
      read: () => say(PAGE_HELP.read), write: () => say(PAGE_HELP.read), music: () => say(PAGE_HELP.music),
      quit: () => confirm('주화면', 155, () => finish({ go: 'title' })),
      swap: () => {
        if (o.remake) sel = [...o.initial]
        else { editing = true; sel = [0] }   // 원작: 누를 때마다 선두만으로 다시 시작
        draw()
      },
      act,
      up: () => { if (page > 0) { page--; drawItems() } },
      down: () => { if ((page + 1) * ITEM.per < o.items.length) { page++; drawItems() } },
    }
    root.querySelectorAll<HTMLButtonElement>('.hit').forEach(b => {
      const k = b.dataset.b!
      b.onclick = () => { if (!dialog) buttons[k]() }
      if (o.remake) {
        const help = k === 'swap' ? PAGE_HELP.swapRemake : k === 'write' ? PAGE_HELP.read : PAGE_HELP[k as keyof typeof PAGE_HELP]
        if (help) b.onmouseenter = () => { if (!dialog) say(help) }
      }
    })
    stage.oncontextmenu = e => { e.preventDefault(); if (dialog) dialog.querySelector<HTMLButtonElement>('.no')!.click(); else cancelEdit() }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); if (dialog) dialog.querySelector<HTMLButtonElement>('.no')!.click(); else cancelEdit() }
      else if (e.key === 'Enter' && o.remake && !dialog) { e.preventDefault(); act() }
    }
    addEventListener('keydown', onKey, true)

    showStatus(0)
    drawItems()
    draw()
    void fadeIn()
    if (o.remake) say('대기인물 클릭 = 출전, 출전인물 클릭 = 빼기. 행동(Enter) = 출발 확인')
  })
}

/** 인물기본자료의 글자 항목. 직업·이동방식은 초상 97~99 이면 안 그림 (원작 7c18) */
function profile(t: UnitType, L: Labels) {
  const hide = t.por >= 97 && t.por <= 99
  return { race: L.race[t.race] ?? '', sex: L.sex[t.sex] ?? '', job: hide ? '' : L.job[t.job] ?? '',
    move: hide ? '' : L.moveKind[t.moveKind] ?? '', rank: L.rank[t.rank] ?? '' }
}
