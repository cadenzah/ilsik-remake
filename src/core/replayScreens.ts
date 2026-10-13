// 개선판 장 지도·도감 화면 (.claude/docs/replay-design.md 3·6절). 타이틀의 .page (640×480) 에 그린다
import { A, loadBattles, loadTables, portraitUrl } from './data'
import { FOUND, HIDDEN, trueEndingOpen } from './replay'
import { loadPlaces, placeLabel, type Place } from './worldmap'
import type { Progress } from './save'

type Cleared = Progress['cleared'][number]

const nav = (extra = '') => `<nav>${extra}<button data-go="0" class="close">돌아가기</button></nav>`

/** 장 지도 (사용자 요청 2026-10-14: 진행에 따라 채워지는 지도, 스포일러 없음): 원작 대륙 지도 위에 가 본 장소의 원작 이름표만 붙이고,
 *  지나온 길을 점선으로 잇는다. 다음 목적지는 빛나는 이름표. 엔딩·갈림길·장 개수는 드러내지 않는다.
 *  이름표를 누르면 그 장소에서 치른 장과 찾은 사건 (두루마리 창) → 다시 하기 */
export async function chapterMap(page: HTMLElement, p: Progress | null,
  play: (c: Cleared) => void, hidden: (n: number) => void, close: () => void) {
  const [places, battles] = await Promise.all([loadPlaces(), loadBattles()])
  const T = battles.route.slice(1)
  const routes = [0, 1, 2].map(k => [...new Set(T.map(row => row[k]))])
  const cleared = p?.cleared ?? []
  const visited = (n: number, route?: number) => cleared.some(c => c.n === n && (route === undefined || c.route === route))
  const common = (n: number) => routes.every(r => r.includes(n))
  const key = (n: number) => { const q = places[n - 1]; return q ? `${q.x},${q.y}` : '' }
  // 장소 묶음 (원작 좌표가 같은 장들) — 가 본 장만
  const groups = new Map<string, number[]>()
  for (const c of cleared) if (places[c.n - 1]) { const g = groups.get(key(c.n)) ?? []; if (!g.includes(c.n)) g.push(c.n); groups.set(key(c.n), g) }
  // 이름표 = 그 장소에서 가장 최근에 치른 장의 것
  const latest = (ns: number[]) => ns.reduce((a, b) => cleared.map(c => c.n).lastIndexOf(b) > cleared.map(c => c.n).lastIndexOf(a) ? b : a)
  const center = (n: number) => { const q = places[n - 1]; return [q.x + q.w / 2, q.y + q.h / 2] }
  // 지나온 길: 루트 순서표대로, 가 본 장만 (공통 장은 어느 루트든)
  const paths = routes.map((r, k) => r.filter(n => n <= 43 && (common(n) ? visited(n) : visited(n, k))))
    .filter(seq => seq.some(n => !common(n)) || seq.length > 1)
    .map(seq => seq.map(center).filter((pt, i, a) => !i || pt.join() !== a[i - 1].join()))
  const next = p?.next && !visited(p.next.n) && places[p.next.n - 1] ? places[p.next.n - 1] : null
  const open = trueEndingOpen(p?.endings)
  page.innerHTML = `<div class="wmap">
      <img class="map" src="${A}/ui/worldmap.png" alt="아모스 대륙 지도">
      <svg class="paths" viewBox="0 0 640 480">${[...new Set(paths.map(pts => pts.map(q => q.join(',')).join(' ')))]
        .map(pts => `<polyline points="${pts}"/>`).join('')}</svg>
      ${open ? `<div class="memory"><b>기억 속의 장소</b>${HIDDEN.map(n => `<button data-hidden="${n}">${n === 44 ? '반란의 밤' : '레스다의 과거'}</button>`).join('')}</div>` : ''}
      <div class="scroll" hidden></div>
    </div>${nav()}`
  const wmap = page.querySelector<HTMLElement>('.wmap')!
  const scroll = page.querySelector<HTMLElement>('.scroll')!
  // 원작은 이름표를 하나씩만 그려 좌표가 가까우면 겹친다 → 겹치면 위아래로 비켜 놓는다
  const taken: { x: number; y: number; w: number; h: number }[] = []
  const nudge = (q: Place) => {
    for (const dy of [0, 24, -24, 48, -48, 72]) {
      const r = { x: q.x, y: q.y + dy, w: q.w, h: q.h }
      if (!taken.some(t => r.x < t.x + t.w && t.x < r.x + r.w && r.y < t.y + t.h && t.y < r.y + r.h)) { taken.push(r); return { ...q, y: r.y } }
    }
    return q
  }
  for (const ns of [...groups.values()].sort((a, b) => a[0] - b[0])) {
    const b = placeLabel(nudge(places[latest(ns) - 1]), 'place on')
    const btn = document.createElement('button')
    btn.className = 'placebtn'
    btn.append(b)
    Object.assign(btn.style, { left: b.style.left, top: b.style.top })
    b.style.left = b.style.top = '0'
    btn.title = `${places[latest(ns) - 1].name} — 치른 장 보기`
    btn.onclick = () => showScroll(ns)
    wmap.append(btn)
  }
  if (next) { const e = placeLabel(nudge(next), 'place next'); e.title = `다음 목적지: ${next.name}`; wmap.append(e) }
  // 두루마리 창: 그 장소에서 치른 장 (다시 하기) + 찾은 사건
  const showScroll = (ns: number[]) => {
    const list = cleared.filter(c => ns.includes(c.n)).sort((a, b) => a.n - b.n || a.route - b.route)
    const found = FOUND.filter(f => ns.includes(f.n) && p?.found?.includes(f.id))
    scroll.innerHTML = `<h3>${[...new Set(ns.map(n => places[n - 1].name))].join(' · ')}</h3>
      ${list.map((c, i) => `<button data-i="${i}">${c.n}장 · ${places[c.n - 1].name}<small>다시 하기</small></button>`).join('')}
      ${found.map(f => `<p>✓ ${f.label}</p>`).join('')}
      <button class="x">닫기</button>`
    scroll.hidden = false
    scroll.querySelectorAll<HTMLButtonElement>('[data-i]').forEach(b => b.onclick = () => play(list[Number(b.dataset.i)]))
    scroll.querySelector<HTMLButtonElement>('.x')!.onclick = hideScroll
    scroll.querySelector<HTMLButtonElement>('button')?.focus()
  }
  const hideScroll = () => { scroll.hidden = true }
  // Esc: 두루마리가 열려 있으면 그것만 닫는다 (타이틀의 Esc = 지도 닫기보다 먼저)
  const onEsc = (e: KeyboardEvent) => {
    if (!scroll.isConnected) { removeEventListener('keydown', onEsc, true); return }   // 지도를 닫았으면 정리
    if (e.key === 'Escape' && !scroll.hidden) { e.stopImmediatePropagation(); hideScroll() }
  }
  addEventListener('keydown', onEsc, true)
  page.querySelectorAll<HTMLButtonElement>('[data-hidden]').forEach(b => b.onclick = () => hidden(Number(b.dataset.hidden)))
  page.querySelector<HTMLButtonElement>('nav .close')!.onclick = () => { removeEventListener('keydown', onEsc, true); close() }
  ;(page.querySelector<HTMLButtonElement>('.placebtn') ?? page.querySelector<HTMLButtonElement>('nav .close'))?.focus()
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
