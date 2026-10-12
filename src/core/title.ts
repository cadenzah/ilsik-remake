// 타이틀 화면: 판 선택 → 새로 시작 / 이어하기 / 장 선택 (클리어한 장) / 크레딧 (팬 게임 고지)
import { A } from './data'
import { lastEdition, loadProgress, resetProgress, setLastEdition, type EditionId } from './save'
import { stageDef, type StageDef } from './stage'

export interface Launch { ed: EditionId; def: StageDef; flags: string[] }

const EDITIONS: { id: EditionId; name: string; desc: string }[] = [
  { id: 'original', name: '원작판', desc: '원작 규칙·조작 그대로' },
  { id: 'remake', name: '개선판', desc: '편의 기능, 다듬은 이야기' },
]

const ROUTE = ['A', 'B', 'C']
const chapterName = (n: number, route: number) => stageDef(n, route).title + (n >= 10 ? ` (${ROUTE[route]} 길)` : '')

const NOTICE = `
  <h2>팬 게임 고지</h2>
  <ul>
    <li>이 게임은 원작 개발사·유통사와 아무 관계가 없는 <b>비공식·비상업 팬 리메이크</b>이며, 어떤 형태로도 판매하거나 수익을 얻지 않습니다.</li>
    <li>원작의 그래픽·사운드·텍스트 등 모든 콘텐츠의 권리는 원 권리자에게 있습니다.</li>
    <li>권리자께서 문제를 제기하시면 즉시 배포를 중단하겠습니다.</li>
  </ul>
  <h2>원작</h2>
  <p>「일식 (Eclipse)」 1995 여름 · 후요우통신 기획제작 · SKC 주식회사 대리발행 (1996 국내 발매)</p>
  <figure><img src="${A}/ui/staff.png" alt="원작 제작진 화면"><figcaption>원작 제작진 화면 (원작 그대로)</figcaption></figure>
  <h2>웹 리메이크</h2>
  <p>원작 파일 분석·추출과 웹 구현 — 비공식 팬 프로젝트</p>`

export function showTitle(): Promise<Launch> {
  const root = document.getElementById('titlescreen')!
  let ed = lastEdition()
  return new Promise(done => {
    const launch = (def: StageDef, flags: string[] = []) => {
      setLastEdition(ed)
      root.hidden = true
      done({ ed, def, flags })
    }

    const panel = (html: string) => {
      root.querySelector('.panel')!.innerHTML = html
      root.querySelector<HTMLButtonElement>('.panel button:not(:disabled)')?.focus()
    }

    const menu = () => {
      const p = loadProgress(ed)
      panel(`
        <div class="editions">${EDITIONS.map(e =>
          `<button data-ed="${e.id}" class="${e.id === ed ? 'on' : ''}" aria-pressed="${e.id === ed}"><b>${e.name}</b><small>${e.desc}</small></button>`).join('')}</div>
        <div class="items">
          <button data-act="new">새로 시작</button>
          <button data-act="continue" ${p ? '' : 'disabled'}>이어하기${p ? `<small>${chapterName(p.next.n, p.next.route)}</small>` : ''}</button>
          <button data-act="chapters" ${p?.cleared.length ? '' : 'disabled'}>장 선택</button>
          <button data-act="credits">크레딧</button>
        </div>`)
      root.querySelectorAll<HTMLButtonElement>('[data-ed]').forEach(b => b.onclick = () => {
        ed = b.dataset.ed as EditionId
        setLastEdition(ed)
        menu()
        root.querySelector<HTMLButtonElement>(`[data-ed="${ed}"]`)?.focus()
      })
      const act = (name: string, fn: () => void) => root.querySelector<HTMLButtonElement>(`[data-act="${name}"]`)!.onclick = fn
      act('new', () => { resetProgress(ed); launch(stageDef(1, 0, true)) })
      act('continue', () => { const p = loadProgress(ed)!; launch(stageDef(p.next.n, p.next.route, true), p.flags) })
      act('chapters', chapters)
      act('credits', () => { panel(`<div class="credits">${NOTICE}</div><button data-act="back">뒤로</button>`); act('back', menu) })
    }

    // 클리어한 장 다시 하기. 진행 저장에는 영향 없음
    const chapters = () => {
      const p = loadProgress(ed)!
      const list = [...p.cleared].sort((a, b) => a.n - b.n || a.route - b.route)
      panel(`<h2>장 선택 · ${EDITIONS.find(e => e.id === ed)!.name}</h2>
        <div class="chapters">${list.map((c, i) => `<button data-i="${i}">${chapterName(c.n, c.route)}</button>`).join('')}</div>
        <button data-act="back">뒤로</button>`)
      root.querySelectorAll<HTMLButtonElement>('[data-i]').forEach(b => b.onclick = () => {
        const c = list[Number(b.dataset.i)]
        launch(stageDef(c.n, c.route), p.flags)
      })
      root.querySelector<HTMLButtonElement>('[data-act="back"]')!.onclick = menu
    }

    root.innerHTML = `<img class="logo" src="${A}/ui/title.png" alt="일식 Eclipse"><div class="panel"></div>`
    root.hidden = false
    menu()
  })
}
