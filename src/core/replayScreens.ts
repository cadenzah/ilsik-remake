// 개선판 장 지도·도감 화면 (.claude/docs/replay-design.md 3·6절). 타이틀의 .page (640×480) 에 그린다
import { loadBattles, loadTables, portraitUrl } from './data'
import { FOUND, HIDDEN, ROUTE_NAMES, trueEndingOpen } from './replay'
import type { Progress } from './save'

type Cleared = Progress['cleared'][number]
const ROUTE = ['A', 'B', 'C']

const nav = (extra = '') => `<nav>${extra}<button data-go="0" class="close">돌아가기</button></nav>`

/** 장 지도: 1~9장 → 세 갈래 (루트 순서표) → 36~43장 → 숨은 장. 가 본 장은 장소와 함께 눌러 다시 하기, 안 가 본 장은 "?" (사용자 결정) */
export async function chapterMap(page: HTMLElement, p: Progress | null, cards: Map<number, string>,
  play: (c: Cleared) => void, hidden: (n: number) => void, close: () => void) {
  const T = (await loadBattles()).route.slice(1)
  const routes = [0, 1, 2].map(k => [...new Set(T.map(row => row[k]))])
  const before = routes[0].filter(n => n <= 9), after = routes[0].filter(n => n >= 36)
  const mid = routes.map(r => r.filter(n => n > 9 && n < 36))
  const cleared = p?.cleared ?? []
  const plays: Cleared[] = []
  const chip = (n: number, route?: number) => {
    const c = cleared.find(c => c.n === n && (route === undefined || c.route === route))
    if (!c) return `<span class="chip">?</span>`
    plays.push(c)
    const place = cards.get(n) ?? ''
    return `<button class="chip on" data-play="${plays.length - 1}" title="${n}장 · ${place} — 다시 하기 (진행에는 영향 없음)">${n}<small>${place}</small></button>`
  }
  const open = trueEndingOpen(p?.endings)
  const hiddenChip = (n: number) => open
    ? `<button class="chip on hidden" data-hidden="${n}" title="숨은 장 — 세 길을 모두 걸은 이에게">${n}<small>숨은 장</small></button>`
    : `<span class="chip hidden">?</span>`
  const found = FOUND.filter(f => p?.found?.includes(f.id))
  const missed = FOUND.length - found.length
  page.innerHTML = `<div class="cmap">
      <h2>장 지도</h2>
      <div class="ends">엔딩 ${ROUTE.map((r, k) => `<b class="${p?.endings?.includes(k) ? 'on' : ''}">${r}</b>`).join(' ')}</div>
      <div class="line">${before.map(n => chip(n)).join('')}</div>
      <div class="cols">${mid.map((ns, k) => `<div class="col"><h3>${ROUTE[k]} · ${ROUTE_NAMES[k]}</h3>
        <div class="chips">${ns.map(n => chip(n, k)).join('')}</div></div>`).join('')}</div>
      <div class="line">${after.map(n => chip(n)).join('')}${HIDDEN.map(hiddenChip).join('')}</div>
      <div class="found">${found.map(f => `<span>✓ ${f.label}</span>`).join('')}${missed ? `<span class="missed">놓친 사건 ${missed}개</span>` : ''}</div>
    </div>${nav()}`
  page.querySelectorAll<HTMLButtonElement>('[data-play]').forEach(b => b.onclick = () => play(plays[Number(b.dataset.play)]))
  page.querySelectorAll<HTMLButtonElement>('[data-hidden]').forEach(b => b.onclick = () => hidden(Number(b.dataset.hidden)))
  page.querySelector<HTMLButtonElement>('nav .close')!.onclick = close
  ;(page.querySelector<HTMLButtonElement>('.chip.on') ?? page.querySelector<HTMLButtonElement>('nav .close'))?.focus()
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
