// 개선판 장 지도·도감 화면 (.claude/docs/replay-design.md 3·6절). 타이틀의 .page (640×480) 에 그린다
import { A, loadBattles, loadTables, portraitUrl } from './data'
import { FOUND, HIDDEN, trueEndingOpen } from './replay'
import { loadPlaces, placeLabel, type Place } from './worldmap'
import type { Progress } from './save'

type Cleared = Progress['cleared'][number]

const nav = (extra = '') => `<nav>${extra}<button data-go="0" class="close">돌아가기</button></nav>`

/** 장 지도 (사용자 설계 2026-10-14, replay-design.md "장 지도 3판"):
 *  - 오른쪽에 늘 클리어한 장 목록 (시작·갈래별·사바카 성·기억 속의 장소). 갈래는 깬 것만 드러난다
 *  - 지도에는 가 본 장소의 원작 이름표, 지금 갈래의 여정만 점선으로, 마지막 장소에 아리크스, 다음 목적지는 빛나는 이름표
 *  - 목록의 장에 올리면 그 장소만 밝고 나머지는 어둡게. 이름표·목록을 누르면 그 장소에서 치른 장 팝업 → 다시 하기
 *  - "지도만 보기" = 목록과 어둠을 걷고 지도 전체. 진엔딩(45 클리어) 뒤엔 숨은 장소 이름표와 떠오른 해 */
const ROUTE_TRAIL = ['혼탁한 호수 길', '암흑동굴 길', '옛 신전 길']   // 원작 진로 메뉴 문구 (0aa2:0b0d)
const HIDDEN_PLACE: Record<number, { name: string; title: string; x: number; y: number }> = {
  44: { name: '아도 왕성', title: '반란의 밤', x: 498, y: 240 } /* 사바카의 궁전 오른쪽 위 빈 바다 */, 45: { name: '국경 마을', title: '레스다의 과거', x: 30, y: 262 } }

export async function chapterMap(page: HTMLElement, p: Progress | null,
  play: (c: Cleared) => void, hidden: (n: number) => void, close: () => void) {
  const [places, battles, tables] = await Promise.all([loadPlaces(), loadBattles(), loadTables()])
  const types = tables.types
  const T = battles.route.slice(1)
  const routes = [0, 1, 2].map(k => [...new Set(T.map(row => row[k]))])
  const cleared = p?.cleared ?? []
  const visited = (n: number, route?: number) => cleared.some(c => c.n === n && (route === undefined || c.route === route))
  const common = (n: number) => routes.every(r => r.includes(n))
  const key = (n: number) => `${places[n - 1].x},${places[n - 1].y}`
  const cur = p?.next?.route ?? 0   // 지금 갈래 = 이어하기의 루트
  const order = cleared.map(c => c.n)
  const latest = (ns: number[]) => ns.reduce((a, b) => order.lastIndexOf(b) > order.lastIndexOf(a) ? b : a)

  // 장소 묶음 (원작 좌표가 같은 장들)
  const groups = new Map<string, number[]>()
  for (const c of cleared) if (places[c.n - 1]) { const g = groups.get(key(c.n)) ?? []; if (!g.includes(c.n)) g.push(c.n); groups.set(key(c.n), g) }
  // 지금 갈래의 여정 (루트 순서표, 가 본 장만). 9장 뒤는 이 갈래에서 깬 장만 (지난 판의 공통 장 26·36~43 은 빼고)
  const trail = routes[cur].filter(n => n <= 43 && (n <= 9 ? visited(n) : visited(n, cur)))
  const center = (q: { x: number; y: number; w: number; h: number }) => [q.x + q.w / 2, q.y + q.h / 2]
  const next = p?.next && !visited(p.next.n) && places[p.next.n - 1] ? p.next.n : 0
  const trueEnd = !!p?.hidden?.includes(45)

  // 이름표 자리: 원작 좌표, 겹치면 위아래로 비킴
  const taken: { x: number; y: number; w: number; h: number }[] = []
  const nudge = <Q extends { x: number; y: number; w: number; h: number }>(q: Q): Q => {
    for (const dy of [0, 24, -24, 48, -48, 72]) {
      const r = { x: q.x, y: q.y + dy, w: q.w, h: q.h }
      if (!taken.some(t => r.x < t.x + t.w && t.x < r.x + r.w && r.y < t.y + t.h && t.y < r.y + r.h)) { taken.push(r); return { ...q, y: r.y } }
    }
    return q
  }
  const spot = new Map<string, Place>()
  for (const ns of [...groups.values()].sort((a, b) => a[0] - b[0])) spot.set(key(ns[0]), nudge(places[latest(ns) - 1]))
  const nextSpot = next ? nudge(places[next - 1]) : null
  // 길 = 장소를 처음 찾아간 순서. 원작은 여러 장이 한 자리라 여정이 같은 곳을 오간다 (바하라무성 ↔ 상지스 광장·고신전) →
  // 되돌아가는 선까지 그리면 거의 겹친 선이 굵게 보인다 (사용자 지적) → 이미 가 본 곳으로 돌아가는 구간은 그리지 않는다
  const pts = [...new Map(trail.map(n => [key(n), center(spot.get(key(n))!)] as const)).values()]
  if (nextSpot) pts.push(center(nextSpot))
  const segs = pts.slice(1).map((q, i) => `M${pts[i].join(' ')}L${q.join(' ')}`).join('')

  page.innerHTML = `<div class="wmap list">
      <div class="mapbox">
        <img class="map" src="${A}/ui/worldmap.png" alt="아모스 대륙 지도">
        <svg class="paths" viewBox="0 0 640 480">${['under', 'trail'].map(c => `<path class="${c}" d="${segs}"/>`).join('')}</svg>
        <div class="dim"></div>
        <div class="labels"></div>
      </div>
      <aside class="clist"></aside>
      <div class="popup" hidden></div>
    </div>${nav('<button class="toggle">지도만 보기</button>')}`
  const wmap = page.querySelector<HTMLElement>('.wmap')!
  const labels = page.querySelector<HTMLElement>('.labels')!
  const popup = page.querySelector<HTMLElement>('.popup')!

  // 지도 위 이름표 (가 본 장소) → 누르면 팝업
  for (const [k, ns] of groups) {
    const q = spot.get(k)!
    const btn = document.createElement('button')
    btn.className = 'placebtn'
    btn.dataset.key = k
    Object.assign(btn.style, { left: `${q.x}px`, top: `${q.y}px` })
    const lab = placeLabel({ ...q, x: 0, y: 0 }, 'place on')
    btn.append(lab)
    btn.title = `${q.name} — 이곳에서 치른 장`
    btn.onclick = () => showPopup(ns)
    labels.append(btn)
  }
  if (nextSpot) {
    const e = placeLabel(nextSpot, 'place next')
    e.title = `다음 목적지: ${nextSpot.name}`
    labels.append(e)
  }
  // 아리크스: 지금 갈래 여정의 마지막 장소 (37장 뒤면 2차 모습)
  const lastN = trail[trail.length - 1]
  if (lastN) {
    const q = spot.get(key(lastN))!, hero = document.createElement('i')
    hero.className = 'hero'
    hero.style.backgroundImage = `url(${A}/units/${String((p?.party?.[0] ?? 0) === 1 ? 1 : 0).padStart(3, '0')}.png)`
    const hx = q.x + q.w / 2 - 28, hy = q.y > 50 ? q.y - 42 : q.y + q.h - 6
    taken.push({ x: hx + 10, y: hy, w: 36, h: 44 })   // 숨은 장소 이름표가 덮지 않게
    Object.assign(hero.style, { left: `${hx}px`, top: `${hy}px` })
    hero.title = `지금 여기: ${lastN}장 ${places[lastN - 1].name}`
    labels.append(hero)
  }
  // 진엔딩 표식: 숨은 장소 이름표 + 떠오른 해
  if (trueEnd) {
    for (const n of HIDDEN) {
      const h = HIDDEN_PLACE[n], q = nudge({ x: h.x, y: h.y, w: 12 * (h.name.length + h.title.length) + 30, h: 20 })
      labels.insertAdjacentHTML('beforeend', `<span class="hplace" style="left:${q.x}px;top:${q.y}px">${h.name} · ${h.title}</span>`)
      const e = labels.lastElementChild as HTMLElement   // 실제 폭으로 지도 안에 들인다
      e.style.left = `${Math.max(4, Math.min(q.x, 636 - e.offsetWidth))}px`
    }
    labels.insertAdjacentHTML('beforeend', '<span class="sun" title="일식이 걷히다"><i></i><b>일식이 걷히다</b></span>')
  }

  // 오른쪽 목록: 시작(공통 앞) · 깬 갈래별 · 사바카 성(공통 뒤) · 기억 속의 장소
  const row = (n: number, route: number | undefined, extra = '') =>
    `<button class="crow${n === next ? ' next' : ''}" data-n="${n}"${route === undefined ? '' : ` data-route="${route}"`}>
      <b>${n}</b><span>${places[n - 1]?.name ?? ''}<small>${places[n - 1]?.title ?? ''}</small></span>${extra}</button>`
  const nextRow = (seq: number[]) => next && seq.includes(next) ? row(next, undefined, '<em>다음</em>') : ''
  const pre = routes[0].filter(n => n <= 9), post = routes[0].filter(n => n >= 36)
  const sec = (title: string, body: string) => body ? `<section><h4>${title}</h4>${body}</section>` : ''
  const branchSecs = [0, 1, 2].map(k => {
    const ns = routes[k].filter(n => n > 9 && n < 36 && visited(n, k))
    if (!ns.length) return ''
    return sec(ROUTE_TRAIL[k] + (k === cur ? ' · 지금' : ''), ns.map(n => row(n, k)).join('') + (k === cur ? nextRow(routes[k].filter(n => n > 9 && n < 36)) : ''))
  })
  const memory = trueEndingOpen(p?.endings) ? sec('기억 속의 장소', HIDDEN.map(n =>
    `<button class="crow hidden" data-hidden="${n}"><b>✦</b><span>${HIDDEN_PLACE[n].title}<small>${HIDDEN_PLACE[n].name}${p?.hidden?.includes(n) ? ' · 클리어' : ''}</small></span></button>`).join('')) : ''
  page.querySelector<HTMLElement>('.clist')!.innerHTML = `<h3>클리어한 장</h3>`
    + sec('여정의 시작', pre.filter(n => visited(n)).map(n => row(n, undefined)).join('') + nextRow(pre))
    + branchSecs.join('')
    + sec('사바카 성', post.filter(n => visited(n)).map(n => row(n, undefined)).join('') + nextRow(post))
    + memory
    + (cleared.length ? '' : '<p>아직 클리어한 장이 없다</p>')

  // 목록에 올리면 그 장소만 밝게
  const focus = (n: number | null) => {
    wmap.classList.toggle('focus', !!n)
    labels.querySelectorAll('.lit').forEach(e => e.classList.remove('lit'))
    if (!n || !places[n - 1]) return
    const k = key(n)
    labels.querySelector(`.placebtn[data-key="${k}"]`)?.classList.add('lit')
    if (n === next) labels.querySelector('.place.next')?.classList.add('lit')
  }
  page.querySelectorAll<HTMLButtonElement>('.crow[data-n]').forEach(b => {
    const n = Number(b.dataset.n)
    b.onmouseenter = b.onfocus = () => focus(n)
    b.onmouseleave = b.onblur = () => focus(null)
    b.onclick = () => { if (groups.has(key(n))) showPopup(groups.get(key(n))!, n, b.dataset.route === undefined ? undefined : Number(b.dataset.route)) }
  })
  page.querySelectorAll<HTMLButtonElement>('[data-hidden]').forEach(b => b.onclick = () => hidden(Number(b.dataset.hidden)))

  // 팝업: 그 장소에서 치른 장 (번호·원작 제목·장소·갈래) → 다시 하기, 찾은 사건
  const showPopup = (ns: number[], first?: number, route?: number) => {
    // 장마다 한 줄. 세 갈래가 함께 지나는 장(16·19·26·36~43)은 판마다 기록이 있고 일행이 다르다 →
    // 깬 갈래마다 다시 하기 버튼, 올리면 그 판에 함께한 동료 (목록의 갈래 줄에서 왔으면 그 갈래 버튼을 앞에·강조)
    const ns2 = [...new Set(cleared.filter(c => ns.includes(c.n)).map(c => c.n))].sort((a, b) => (b === first ? 1 : 0) - (a === first ? 1 : 0) || a - b)
    const recs = ns2.map(n => cleared.filter(c => c.n === n).sort((a, b) => (b.route === route ? 1 : 0) - (a.route === route ? 1 : 0) || a.route - b.route))
    const flat = recs.flat()
    const crew = (c: Cleared) => (c.at?.party ?? []).map(t => types[t]?.name).filter(Boolean).join(' · ')
    const found = FOUND.filter(f => ns.includes(f.n) && p?.found?.includes(f.id))
    popup.innerHTML = `<h3>${[...new Set(ns.map(n => places[n - 1].name))].join(' · ')}</h3>
      ${ns2.map((n, k) => `<div class="prow"><b>${n}장</b><span>「${places[n - 1].title}」<small>${places[n - 1].name}${common(n) || recs[k].length > 1 ? '' : ` · ${ROUTE_TRAIL[recs[k][0].route]}`}</small></span>
        ${recs[k].length === 1 ? `<button data-i="${flat.indexOf(recs[k][0])}" title="${crew(recs[k][0])}">다시 하기</button>`
          : `<div class="via"><small>어느 길에서 온 판으로?</small>${recs[k].map(c => `<button data-i="${flat.indexOf(c)}" class="${c.route === route ? 'pri' : ''}">${ROUTE_TRAIL[c.route].replace(/ 길$/, '')}</button>`).join('')}</div>`}
        </div>`).join('')}
      <p class="crew" hidden></p>
      ${found.map(f => `<p>✓ ${f.label}</p>`).join('')}
      <button class="x">닫기</button>`
    popup.hidden = false
    const crewLine = popup.querySelector<HTMLElement>('.crew')!
    popup.querySelectorAll<HTMLButtonElement>('[data-i]').forEach(b => {
      const c = flat[Number(b.dataset.i)]
      b.onclick = () => play(c)
      b.onmouseenter = b.onfocus = () => { crewLine.hidden = false; crewLine.textContent = `${c.n}장 · ${ROUTE_TRAIL[c.route]} 판의 일행: ${crew(c) || '기록 없음'}` }
      b.onmouseleave = b.onblur = () => { crewLine.hidden = true }
    })
    popup.querySelector<HTMLButtonElement>('.x')!.onclick = hidePopup
    popup.querySelector<HTMLButtonElement>('[data-i]')?.focus()
  }
  const hidePopup = () => { popup.hidden = true }
  // Esc: 팝업이 열려 있으면 그것만 닫는다 (타이틀의 Esc = 지도 닫기보다 먼저)
  const onEsc = (e: KeyboardEvent) => {
    if (!popup.isConnected) { removeEventListener('keydown', onEsc, true); return }   // 지도를 닫았으면 정리
    if (e.key === 'Escape' && !popup.hidden) { e.stopImmediatePropagation(); hidePopup() }
  }
  addEventListener('keydown', onEsc, true)
  // 지도만 보기 ↔ 목록 보기
  const toggle = page.querySelector<HTMLButtonElement>('nav .toggle')!
  toggle.onclick = () => { const on = wmap.classList.toggle('list'); toggle.textContent = on ? '지도만 보기' : '목록 보기'; focus(null) }
  page.querySelector<HTMLButtonElement>('nav .close')!.onclick = () => { removeEventListener('keydown', onEsc, true); close() }
  ;(page.querySelector<HTMLButtonElement>('.crow') ?? page.querySelector<HTMLButtonElement>('nav .close'))?.focus()
}

/** 도감: 판을 넘어 만난 인물·적, 손에 넣은 도구 */
export async function codex(page: HTMLElement, p: Progress | null, close: () => void) {
  const t = await loadTables()
  const seen = new Set(p?.seen?.units ?? []), items = new Set(p?.seen?.items ?? [])
  const groups: [string, (id: number) => boolean][] = [['동료', id => id < 29], ['적', id => id >= 29 && id < 100], ['그 밖의 인물', id => id >= 100]]
  const unitCell = (id: number) => {
    const u = t.types[id]
    return `<div class="cell"><img src="${portraitUrl(u.por)}" alt=""><div><b>${u.name}</b>
      <small>Lv ${u.lv} · ${t.labels.job[u.job] ?? ''} · HP ${u.hp}</small></div></div>`
  }
  // 같은 이름·초상화(일반 병사 등)는 한 번만
  const uniq = (ids: number[]) => ids.filter((id, i) => ids.findIndex(j => t.types[j].name === t.types[id].name && t.types[j].por === t.types[id].por) === i)
  const ids = [...seen].sort((a, b) => a - b)
  const itemCats: [string, number][] = [['무기', 0], ['방어구', 1], ['도구', 2]]
  const allItems = [...t.items.values()]
  page.innerHTML = `<div class="codex">
      <h2>도감</h2>
      ${groups.map(([title, f]) => {
        const list = uniq(ids.filter(f))
        const total = uniq(t.types.map(u => u.id).filter(f)).length
        return `<h3>${title} <small>${list.length} / ${total}</small></h3><div class="cells">${list.map(unitCell).join('') || '<p>아직 없음</p>'}</div>`
      }).join('')}
      ${itemCats.map(([title, cat]) => {
        const list = allItems.filter(i => i.cat === cat && items.has(i.id))
        return `<h3>${title} <small>${list.length} / ${allItems.filter(i => i.cat === cat).length}</small></h3>
          <div class="items">${list.map(i => `<span>${i.name}</span>`).join('') || '<p>아직 없음</p>'}</div>`
      }).join('')}
    </div>${nav()}`
  page.querySelector<HTMLButtonElement>('nav .close')!.onclick = close
  page.querySelector<HTMLButtonElement>('nav .close')!.focus()
}
