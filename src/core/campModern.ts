// 현대식 정비 화면 (개선판 설정 modernUi, ux-proposal.md 36). 원작 640×480 배치를 버리고 창 크기에 맞춘 패널 배치:
//   위 바 = 장 이름·목표·출전 수·[출전], 왼쪽 = 부대 명단 (출전 → 대기 두 무리, 필터 칩), 오른쪽 = 고른 인물 카드 + 소지품, 아래 바 = 기록·불러오기·타이틀.
// 규칙은 원작·개선판 정비 화면과 같다: 선두(일행 0번)는 늘 출전 맨 앞, 출전 상한 o.max, 정비 화면에서 바꿀 수 있는 장비는 도구 칸 (canEquip).
// 조작: 명단 클릭·Space = 출전 넣고 빼기, 끌기 = 순서·넣고 빼기, Alt+↑↓ = 순서. 소지품 클릭 = 고르기 (비교·[장착][버리기]),
//   두 번 클릭·E = 장착, Del = 버리기, 끌어서 도구 칸·명단 인물에 놓기 = 장착, 도구 칸을 소지품으로 끌기 = 해제.
//   ↑↓←→ = 목록 안 이동, Tab = 다음 무리, Enter = 출전 확인, Esc = 고른 것 풀기·창 닫기.
import { MAGIC_EFFECTS, STAT_NAMES, type Item, type UnitType } from './data'
import { canEquip, icon, profile, sprite, type CampOptions, type CampResult } from './camp'
import { fadeIn, fadeOut } from './fade'
import { esc } from './ui'
import { equippedStats, type Stats } from './unit'

const STAT_LABEL: [keyof Stats, string][] = [['maxHp', '생명'], ['atk', '역량'], ['def', '방어'], ['spi', '정신'], ['agi', '민첩'], ['mov', '이동력']]
const CAT = ['무기', '방어', '도구']
type InvFilter = 'all' | 0 | 1 | 2
type Drag = { kind: 'item'; k: number } | { kind: 'unit'; i: number } | { kind: 'tool' }

/** 도구 효과 글 ("역량 +3 · 민첩 -1") */
const effects = (it: Item) => [it.stat, it.stat2].filter(([n, v]) => n && v)
  .map(([n, v]) => `${STAT_NAMES[n > 8 ? n - 8 : n]} ${n > 8 ? '-' : '+'}${v}`).join(' · ')

export function campModern(o: CampOptions): Promise<CampResult> {
  const party = o.party.map(t => ({ ...t, equip: [...t.equip] as UnitType['equip'] }))
  const items = [...o.items]
  let sel = [...o.initial]
  let shown = 0
  let picked: number | null = null      // 고른 소지품 (items 색인)
  let peek: number | null = null        // 마우스를 올린 소지품 (비교만)
  let rosterFilter: 'all' | 'in' | 'out' = 'all'
  let invFilter: InvFilter = 'all'
  let modal: HTMLElement | null = null
  let note = ''

  const root = document.createElement('section')
  root.id = 'mcamp'
  root.innerHTML = `
    <header class="mc-head">
      <div class="mc-title"><b>${esc(o.header?.title ?? '정비')}</b>${o.header?.goal ? `<span>${esc(o.header.goal)}</span>` : ''}</div>
      <span class="mc-count"></span>
      <button class="mc-go" title="출전 인물로 전투를 시작한다 (Enter)">출전 ▶</button>
    </header>
    <main class="mc-main">
      <section class="mc-panel mc-roster" aria-label="부대 명단">
        <div class="mc-chips" role="tablist"></div>
        <div class="mc-list"></div>
        <p class="mc-hint">클릭·Space = 출전 넣고 빼기 · 끌기·Alt+↑↓ = 순서</p>
      </section>
      <div class="mc-right">
        <section class="mc-panel mc-detail" aria-label="인물 정보"></section>
        <section class="mc-panel mc-inv" aria-label="소지품" data-drop="inv">
          <div class="mc-invhead"><b class="mc-label">소지품</b><span class="mc-chips"></span></div>
          <div class="mc-grid"></div>
          <div class="mc-info"></div>
        </section>
      </div>
    </main>
    <footer class="mc-foot">
      <button data-f="write">기록</button><button data-f="read">불러오기</button>
      <span class="mc-note" role="status"></span>
      <button data-f="quit">타이틀</button>
    </footer>`
  document.body.append(root)
  // 큰 창에서는 통째로 키운다 (1200×760 기준, 1~1.5배). 작은 창은 1배 그대로 두고 배치가 바뀐다
  let zoom = 1
  const fit = () => { zoom = Math.max(1, Math.min(1.5, innerWidth / 1200, innerHeight / 760)); root.style.zoom = String(zoom) }
  fit()
  addEventListener('resize', fit)
  const $ = <T extends HTMLElement>(q: string) => root.querySelector<T>(q)!
  const list = $('.mc-list'), detail = $('.mc-detail'), grid = $('.mc-grid'), info = $('.mc-info')

  // ---------- 편성 ----------
  const full = () => sel.length >= o.max
  const toggle = (i: number) => {
    if (i === 0) return   // 선두는 뺄 수 없다
    const j = sel.indexOf(i)
    if (j >= 0) sel.splice(j, 1)
    else if (!full()) sel.push(i)
    else { say(`출전은 ${o.max}명까지입니다.`); return }
    render()
  }
  /** 출전 순서 j 자리에 넣기·옮기기 (선두 앞으로는 못 감) */
  const placeAt = (i: number, j: number) => {
    if (i === 0) return
    const from = sel.indexOf(i)
    if (from < 0 && full()) { say(`출전은 ${o.max}명까지입니다.`); return }
    if (from >= 0) { sel.splice(from, 1); if (from < j) j-- }
    sel.splice(Math.max(1, Math.min(j, sel.length)), 0, i)
    render()
  }
  const remove = (i: number) => { const j = sel.indexOf(i); if (j > 0) { sel.splice(j, 1); render() } }

  // ---------- 장비 ----------
  const equipTo = (k: number, i: number) => {
    const t = party[i], it = o.tables.items.get(items[k])
    if (!canEquip(t, it)) { say(it && it.cat !== 2 ? '무기·방어구는 정비 화면에서 바꿀 수 없습니다.' : `${t.name} 은(는) 쓸 수 없는 도구입니다.`); return }
    const old = t.equip[2]
    t.equip[2] = items[k]
    if (old) items[k] = old   // 맞바꿈: 옛 도구가 그 자리로
    else items.splice(k, 1)
    picked = peek = null
    shown = i
    say(`${t.name} — ${it!.name} 장착`)
    render()
  }
  const take = () => {
    const t = party[shown]
    if (!t.equip[2]) return
    const name = o.tables.items.get(t.equip[2])?.name ?? ''
    items.push(t.equip[2])
    t.equip[2] = 0
    picked = peek = null
    say(`${name} 해제`)
    render()
  }
  const trash = (k: number) => {
    const it = o.tables.items.get(items[k])
    ask('버리기', `${esc(it?.name ?? '')} 을(를) 버립니다. 되돌릴 수 없습니다.`, [['버리기', () => { items.splice(k, 1); picked = peek = null; render() }], ['취소', () => {}]])
  }

  // ---------- 그리기 ----------
  const say = (t: string) => { note = t; $('.mc-note').textContent = t }

  const chips = (box: HTMLElement, opts: [string, string][], cur: string, set: (v: string) => void) => {
    box.innerHTML = opts.map(([v, l]) => `<button class="mc-chip ${v === cur ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')
    box.querySelectorAll<HTMLButtonElement>('.mc-chip').forEach(b => { b.onclick = () => set(b.dataset.v!) })
  }

  const row = (i: number) => {
    const t = party[i], j = sel.indexOf(i), on = j >= 0, st = equippedStats(t, o.tables.items), p = profile(t, o.tables.labels)
    const blocked = !on && full()
    return `<button class="mc-row ${on ? 'in' : ''} ${i === shown ? 'shown' : ''} ${blocked ? 'blocked' : ''}" data-i="${i}" data-drop="unit"
        role="checkbox" aria-checked="${on}" tabindex="-1" title="${i === 0 ? '선두 — 늘 출전' : on ? '눌러서 빼기' : blocked ? '출전 칸이 다 찼습니다' : '눌러서 출전'}">
      <span class="mc-check">${on ? '✓' : ''}</span>
      <span class="mc-spr">${sprite(t, false)}</span>
      <span class="mc-name"><b>${esc(t.name)}</b>${i === 0 ? '<em>선두</em>' : ''}<small>${esc(p.job || p.race)} · Lv ${t.lv}</small></span>
      <span class="mc-hp">생명 ${st.maxHp}</span>
      <span class="mc-ord">${on ? j + 1 : ''}</span>
    </button>`
  }

  const renderRoster = () => {
    const out = party.map((_, i) => i).filter(i => !sel.includes(i))
    chips($('.mc-roster .mc-chips'), [['all', `전체 ${party.length}`], ['in', `출전 ${sel.length}`], ['out', `대기 ${out.length}`]], rosterFilter,
      v => { rosterFilter = v as typeof rosterFilter; renderRoster() })
    list.innerHTML =
      (rosterFilter !== 'out' ? `<div class="mc-group" data-drop="deploy"><h4>출전 <span>${sel.length} / ${o.max}</span></h4>${sel.map(row).join('')}</div>` : '') +
      (rosterFilter !== 'in' ? `<div class="mc-group" data-drop="wait"><h4>대기 <span>${out.length}</span></h4>${out.map(row).join('') || '<p class="mc-empty">모두 출전합니다</p>'}</div>` : '')
    list.querySelectorAll<HTMLButtonElement>('.mc-row').forEach(b => {
      const i = Number(b.dataset.i)
      b.onclick = () => {
        const kb = document.activeElement === b
        focusRow = i; shown = i; toggle(i)
        if (kb) list.querySelector<HTMLButtonElement>(`.mc-row[data-i="${i}"]`)?.focus({ preventScroll: true })   // 다시 그려도 초점 유지
      }
      b.onmouseenter = () => { if (picked === null && shown !== i) { shown = i; renderDetail(); renderInv(); markShown() } }
      b.onfocus = () => { if (shown !== i) { shown = i; renderDetail(); renderInv(); markShown() } }
      draggable(b, () => i === 0 ? null : { kind: 'unit', i })
    })
    const f = list.querySelector<HTMLButtonElement>(`.mc-row[data-i="${focusRow}"]`) ?? list.querySelector<HTMLButtonElement>('.mc-row')
    if (f) f.tabIndex = 0
  }
  const markShown = () => list.querySelectorAll<HTMLElement>('.mc-row').forEach(r => r.classList.toggle('shown', Number(r.dataset.i) === shown))
  let focusRow = 0

  const renderDetail = () => {
    const t = party[shown], p = profile(t, o.tables.labels), st = equippedStats(t, o.tables.items)
    const base: Stats = { maxHp: t.hp, atk: t.atk, def: t.def, spi: t.spi, agi: t.agi, mov: t.mov }
    // 고르거나 올린 도구를 이 인물이 끼면 바뀌는 수치
    const cand = o.tables.items.get(items[picked ?? peek ?? -1] ?? -1)
    const after = cand && canEquip(t, cand) ? equippedStats({ ...t, equip: [t.equip[0], t.equip[1], cand.id] }, o.tables.items) : null
    const stat = ([k, l]: [keyof Stats, string]) => {
      const bonus = st[k] - base[k], d = after ? after[k] - st[k] : 0
      return `<div class="mc-stat"><span>${l}</span><b>${st[k]}</b>${bonus ? `<i class="${bonus > 0 ? 'up' : 'down'}">${bonus > 0 ? '+' : ''}${bonus}</i>` : ''}${
        d ? `<em class="${d > 0 ? 'up' : 'down'}">→ ${after![k]}</em>` : ''}</div>`
    }
    const slot = (c: number) => {
      const id = t.equip[c], it = o.tables.items.get(id)
      const tool = c === 2
      return `<div class="mc-slot ${tool ? 'tool' : ''} ${tool && cand && after ? 'target' : ''}" ${tool ? 'data-drop="tool"' : ''}>
        <small>${CAT[c]}</small>${it ? `<span class="mc-ico">${icon(id)}</span><b>${esc(it.name)}</b><i>${effects(it)}</i>` : `<b class="mc-none">${tool ? '비어 있음' : '없음'}</b>`}
        ${tool && it ? '<button class="mc-take" title="도구를 풀어 소지품에 넣는다 (소지품으로 끌어도 됨)">해제</button>' : ''}</div>`
    }
    const magic = t.magic.map(id => o.tables.magic.get(id)).filter(Boolean)
    detail.innerHTML = `
      <div class="mc-card">
        <i class="mc-por" style="background-position:-${(t.por % 12) * 96}px -${Math.floor(t.por / 12) * 111}px"></i>
        <div class="mc-who">
          <h3>${esc(t.name)}${shown === 0 ? '<em>선두</em>' : ''}</h3>
          <p>${[p.race, p.sex, p.job].filter(Boolean).map(esc).join(' · ')} · Lv ${t.lv} · 경험 ${t.exp}</p>
          <p class="dim">${[p.move && `이동 ${esc(p.move)}`, p.rank && `부하상태 ${esc(p.rank)}`, `피로 ${t.fatigue}`].filter(Boolean).join(' · ')}</p>
          <div class="mc-stats">${STAT_LABEL.map(stat).join('')}</div>
        </div>
      </div>
      <div class="mc-slots">${[0, 1, 2].map(slot).join('')}</div>
      <div class="mc-magic">${magic.length ? magic.map(m => `<span class="mc-mg" title="${esc(MAGIC_EFFECTS[m!.effect] ?? '')} · 피로 +${m!.fatigue}">
        <i style="background-position:-${m!.id * 16}px 0"></i>${esc(m!.name)}</span>`).join('') : '<span class="dim">마법 없음</span>'}</div>`
    detail.querySelector<HTMLButtonElement>('.mc-take')?.addEventListener('click', take)
    const toolSlot = detail.querySelector<HTMLElement>('.mc-slot.tool')!
    if (t.equip[2]) draggable(toolSlot, () => ({ kind: 'tool' }))
  }

  const visible = () => items.map((id, k) => ({ id, k, it: o.tables.items.get(id) })).filter(x => invFilter === 'all' || x.it?.cat === invFilter)
  let focusItem = 0
  const renderInv = () => {
    chips($('.mc-inv .mc-chips'), [['all', '모두'], ['2', '도구'], ['0', '무기'], ['1', '방어']], String(invFilter),
      v => { invFilter = v === 'all' ? 'all' : Number(v) as InvFilter; renderInv() })
    $('.mc-label').textContent = `소지품 ${items.length}`
    const t = party[shown], vis = visible()
    grid.innerHTML = vis.map(({ id, k, it }) => {
      const ok = canEquip(t, it)
      return `<button class="mc-item ${picked === k ? 'picked' : ''} ${ok ? '' : 'no'}" data-k="${k}" tabindex="-1">
        <span class="mc-ico">${icon(id)}</span><b>${esc(it?.name ?? '?')}</b><i>${it ? effects(it) || CAT[it.cat] : ''}</i>
        ${ok ? '' : `<em>${it?.cat === 2 ? '못 씀' : '고정'}</em>`}</button>`
    }).join('') || '<p class="mc-empty">소지품이 없습니다</p>'
    grid.querySelectorAll<HTMLButtonElement>('.mc-item').forEach(b => {
      const k = Number(b.dataset.k)
      b.onclick = () => { focusItem = k; picked = picked === k ? null : k; renderDetail(); renderInv(); grid.querySelector<HTMLButtonElement>(`[data-k="${k}"]`)?.focus() }
      b.ondblclick = () => equipTo(k, shown)
      b.onmouseenter = () => { if (picked === null) { peek = k; renderDetail(); renderInfo() } }
      b.onmouseleave = () => { if (peek === k) { peek = null; renderDetail(); renderInfo() } }
      draggable(b, () => ({ kind: 'item', k }))
    })
    const f = grid.querySelector<HTMLButtonElement>(`[data-k="${focusItem}"]`) ?? grid.querySelector<HTMLButtonElement>('.mc-item')
    if (f) f.tabIndex = 0
    renderInfo()
  }

  const renderInfo = () => {
    const k = picked ?? peek, it = k === null ? undefined : o.tables.items.get(items[k])
    if (!it) { info.innerHTML = '<span class="dim">도구를 누르면 비교·장착·버리기. 끌어서 도구 칸이나 명단 인물에 놓아도 장착됩니다</span>'; return }
    const t = party[shown], ok = canEquip(t, it)
    info.innerHTML = `<b>${esc(it.name)}</b> <span>${effects(it) || CAT[it.cat]}</span>
      <span class="dim">${ok ? `${esc(t.name)} 장착 가능` : it.cat === 2 ? `${esc(t.name)} 은(는) 못 씀` : '무기·방어구는 바꿀 수 없음'}</span>
      ${picked !== null ? `<span class="mc-acts"><button class="mc-eq" ${ok ? '' : 'disabled'}>장착 <kbd>E</kbd></button><button class="mc-trash">버리기 <kbd>Del</kbd></button></span>` : ''}`
    info.querySelector<HTMLButtonElement>('.mc-eq')?.addEventListener('click', () => equipTo(picked!, shown))
    info.querySelector<HTMLButtonElement>('.mc-trash')?.addEventListener('click', () => trash(picked!))
  }

  const render = () => {
    $('.mc-count').textContent = `출전 ${sel.length} / ${o.max}`
    renderRoster(); renderDetail(); renderInv()
  }

  // ---------- 끌어 놓기 (포인터 이벤트: 마우스·펜. 터치는 세로 스크롤을 살리려고 누르기·버튼으로) ----------
  let suppressClick = false
  root.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false } }, true)
  function draggable(el: HTMLElement, data: () => Drag | null) {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || modal || e.pointerType === 'touch') return
      const d = data()
      if (!d) return
      const sx = e.clientX, sy = e.clientY
      let ghost: HTMLElement | null = null, over: HTMLElement | null = null
      const target = (x: number, y: number) => {
        const at = document.elementFromPoint(x, y) as HTMLElement | null
        const t = at?.closest<HTMLElement>('[data-drop]') ?? null
        return t && accepts(d, t) ? t : null
      }
      const move = (ev: PointerEvent) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return
          ghost = el.cloneNode(true) as HTMLElement
          ghost.classList.add('mc-ghost')
          ghost.style.width = `${el.offsetWidth}px`
          root.append(ghost)
          root.classList.add('dragging')
        }
        ghost.style.transform = `translate(${(ev.clientX + 8) / zoom}px, ${(ev.clientY + 8) / zoom}px)`   // 키운 화면 안이라 배율로 나눔
        const t = target(ev.clientX, ev.clientY)
        if (t !== over) { over?.classList.remove('drop-over'); over = t; over?.classList.add('drop-over') }
      }
      const up = (ev: PointerEvent) => {
        removeEventListener('pointermove', move)
        removeEventListener('pointerup', up)
        if (!ghost) return
        ghost.remove()
        root.classList.remove('dragging')
        over?.classList.remove('drop-over')
        suppressClick = true
        setTimeout(() => { suppressClick = false })
        const t = target(ev.clientX, ev.clientY)
        if (t) drop(d, t, ev.clientY)
      }
      addEventListener('pointermove', move)
      addEventListener('pointerup', up)
    })
  }
  const accepts = (d: Drag, t: HTMLElement) => {
    const zone = t.dataset.drop
    if (d.kind === 'item') return zone === 'tool' || zone === 'unit'
    if (d.kind === 'tool') return zone === 'inv'
    return zone === 'deploy' || zone === 'wait' || zone === 'unit'
  }
  const drop = (d: Drag, t: HTMLElement, y: number) => {
    const zone = t.dataset.drop
    if (d.kind === 'item') { equipTo(d.k, zone === 'unit' ? Number(t.dataset.i) : shown); return }
    if (d.kind === 'tool') { take(); return }
    // 인물: 출전 행에 놓으면 그 행 위·아래 자리로, 출전 무리 빈 곳이면 끝에, 대기에 놓으면 빼기
    if (zone === 'unit') {
      const i = Number(t.dataset.i), j = sel.indexOf(i)
      if (j < 0) { remove(d.i); return }
      const r = t.getBoundingClientRect()
      placeAt(d.i, j + (y > r.top + r.height / 2 ? 1 : 0))
    } else if (zone === 'deploy') placeAt(d.i, sel.length)
    else remove(d.i)
  }

  // ---------- 창 (확인·기록 칸) ----------
  type Act = [string, () => void, boolean?]   // 세 번째 = 막음
  function ask(title: string, body: string, acts: Act[]) {
    modal?.remove()
    modal = document.createElement('div')
    modal.className = 'mc-modal'
    modal.innerHTML = `<div class="mc-dlg" role="dialog" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${body ? `<p>${body}</p>` : ''}<div class="mc-btns"></div></div>`
    const box = modal.querySelector('.mc-btns')!
    const close = () => { modal?.remove(); modal = null }
    acts.forEach(([label, fn, off], n) => {
      const b = document.createElement('button')
      if (n === 0 && acts.length === 2) b.className = 'primary'   // 결정·취소 창의 결정 (원작 주황 명령 버튼 색)
      b.textContent = label
      b.disabled = !!off
      b.onclick = () => { close(); fn() }
      box.append(b)
    })
    modal.onclick = e => { if (e.target === modal) close() }
    root.append(modal)
    modal.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }
  const slotNames = () => o.slots?.list() ?? [null, null, null]
  const foot: Record<string, () => void> = {
    write: () => ask('기록', '지금 정비 화면을 어느 칸에 기록할까요?', [...slotNames().map((n, i): Act => [`${i + 1} · ${n ?? '무기록'}`, () => {
      o.slots?.save(i, [...items], party.map(t => t.equip))
      say(`기록 ${i + 1} 칸에 기록했습니다.`)
    }]), ['취소', () => {}]]),
    read: () => ask('불러오기', '기록한 정비 화면을 불러옵니다. 지금 편성은 버려집니다.', [...slotNames().map((n, i): Act => [`${i + 1} · ${n ?? '무기록'}`,
      () => finish({ go: 'load', slot: i }), !n]), ['취소', () => {}]]),
    quit: () => ask('타이틀로', '정비 화면을 닫고 타이틀로 돌아갑니다.', [['타이틀로', () => finish({ go: 'title' })], ['취소', () => {}]]),
  }
  const go = () => ask('출전', `${sel.map(i => esc(party[i].name)).join(' · ')}`, [['출전', () => finish({ go: 'battle', deploy: [...sel], items, equip: party.map(t => t.equip) })], ['취소', () => {}]])

  // ---------- 키보드 ----------
  const rows = () => [...list.querySelectorAll<HTMLButtonElement>('.mc-row')]
  const tiles = () => [...grid.querySelectorAll<HTMLButtonElement>('.mc-item')]
  const cols = () => { const t = tiles(); if (t.length < 2) return 1; const y = t[0].offsetTop; const n = t.findIndex(e => e.offsetTop !== y); return n < 0 ? t.length : n }
  const onKey = (e: KeyboardEvent) => {
    const a = document.activeElement as HTMLElement | null
    if (modal) {
      if (e.key === 'Escape') { e.preventDefault(); modal.remove(); modal = null }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const bs = [...modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')], i = bs.indexOf(a as HTMLButtonElement)
        bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length]?.focus(); e.preventDefault()
      }
      return   // Enter·Space 는 초점 버튼이 받는다
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      if (picked !== null) { picked = null; renderDetail(); renderInv() }
      return
    }
    const inRow = a?.classList.contains('mc-row'), inTile = a?.classList.contains('mc-item')
    // Enter = 출전 (명단·소지품·빈 곳에서). 다른 버튼에 초점이 있으면 그 버튼
    if (e.key === 'Enter' && !e.isComposing && (inRow || inTile || !a || a === document.body || !root.contains(a))) { e.preventDefault(); go(); return }
    if (inRow && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const i = Number(a!.dataset.i), d = e.key === 'ArrowDown' ? 1 : -1
      if (e.altKey) {   // 출전 순서 옮기기
        const j = sel.indexOf(i)
        if (j > 0 && j + d >= 1 && j + d < sel.length) { sel.splice(j, 1); sel.splice(j + d, 0, i); focusRow = i; render(); list.querySelector<HTMLButtonElement>(`.mc-row[data-i="${i}"]`)?.focus() }
        return
      }
      const rs = rows(), n = rs.indexOf(a as HTMLButtonElement), next = rs[n + d]
      if (next) { rs.forEach(r => { r.tabIndex = -1 }); next.tabIndex = 0; focusRow = Number(next.dataset.i); next.focus() }
    } else if (inTile && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
      const ts = tiles(), n = ts.indexOf(a as HTMLButtonElement), c = cols()
      const next = ts[n + ({ ArrowUp: -c, ArrowDown: c, ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[e.key]]
      if (next) { ts.forEach(t => { t.tabIndex = -1 }); next.tabIndex = 0; focusItem = Number(next.dataset.k); next.focus() }
    } else if ((e.key === 'e' || e.key === 'E') && picked !== null) { e.preventDefault(); equipTo(picked, shown) }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && picked !== null) { e.preventDefault(); trash(picked) }
  }
  root.oncontextmenu = e => { e.preventDefault(); if (modal) { modal.remove(); modal = null } else if (picked !== null) { picked = null; renderDetail(); renderInv() } }

  let finish: (r: CampResult) => void = () => {}
  return new Promise(done => {
    finish = r => {
      removeEventListener('keydown', onKey, true)
      removeEventListener('resize', fit)
      if (r.go === 'title') { done(r); return }   // 타이틀로는 toTitle 이 어둡게 한 뒤 새로 불러온다
      void fadeOut().then(() => { root.remove(); done(r) })
    }
    addEventListener('keydown', onKey, true)
    $('.mc-go').onclick = go
    root.querySelectorAll<HTMLButtonElement>('.mc-foot [data-f]').forEach(b => { b.onclick = () => foot[b.dataset.f!]() })
    render()
    say(note)
    void fadeIn()
    list.querySelector<HTMLButtonElement>('.mc-row')?.focus({ preventScroll: true })
  })
}

