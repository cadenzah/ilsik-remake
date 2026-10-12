// 타이틀·메인 메뉴 — 원작 124e:e404 재현 (formats.md "메인 메뉴")
// 원작: 돌판 로고(ECPMARK 0)가 세 번 번쩍(세 번째에 천둥) → 밝아져 4초 → 어두워지고 두루마리 노인(ECPMARK 1) 위
// (460,0) 돌 창틀에 유랑천하·지난흔적·게임종료. 게임종료는 제작진·발행 화면(ECPPLANE)을 보여 주고 끝난다.
// 웹: 게임종료 자리에 장 선택·제작진(팬 게임 고지 포함)·판 선택을 같은 창에 둔다. 화면은 640×480 을 통째로 확대
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

const INTRO_SEEN = 'eclipse.introSeen'   // 같은 탭에서 타이틀로 돌아올 때는 로고 연출을 건너뛴다
const sleep = (ms: number) => new Promise(ok => setTimeout(ok, ms))
const rand = (n: number) => Math.floor(Math.random() * n)

const NOTICE = `
  <p>이 게임은 원작 개발사·유통사와 관계없는<br>비공식·비상업 팬 리메이크입니다.</p>
  <p>원작의 그래픽·사운드·텍스트 등 모든 콘텐츠의<br>권리는 원 권리자에게 있습니다.</p>
  <p>권리자께서 문제를 제기하시면<br>즉시 배포를 중단하겠습니다.</p>`

export function showTitle(): Promise<Launch> {
  const root = document.getElementById('titlescreen')!
  root.innerHTML = `<div class="stage">
      <img class="bg" alt="">
      <div class="win" hidden><div class="body"></div></div>
      <div class="page" hidden></div>
    </div>`
  root.hidden = false
  const stage = root.querySelector<HTMLElement>('.stage')!
  const bg = root.querySelector<HTMLImageElement>('.bg')!
  const win = root.querySelector<HTMLElement>('.win')!
  const body = root.querySelector<HTMLElement>('.body')!
  const page = root.querySelector<HTMLElement>('.page')!

  // 640×480 을 화면에 꼭 맞게 (가로세로 비 유지)
  const fit = () => stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / 640, innerHeight / 480)})`
  fit()
  addEventListener('resize', fit)

  let ed = lastEdition()

  return new Promise(done => {
    const launch = (def: StageDef, flags: string[] = []) => {
      setLastEdition(ed)
      removeEventListener('resize', fit)
      removeEventListener('keydown', onKey)
      root.hidden = true
      root.innerHTML = ''
      done({ ed, def, flags })
    }

    // 창 안 항목. img = 원작 버튼 그림 (보통/강조 2단), 없으면 같은 모양의 글자
    type Row = { label: string; img?: string; on?: () => void; cls?: string; title?: string }
    const rows = (items: Row[]) => {
      body.innerHTML = ''
      for (const r of items) {
        const b = document.createElement('button')
        b.className = `row ${r.img ? 'pic' : 'txt'} ${r.cls ?? ''}`
        if (r.img) { b.style.backgroundImage = `url(${A}/ui/${r.img})`; b.setAttribute('aria-label', r.label) }
        else b.textContent = r.label
        if (r.title) b.title = r.title
        if (r.on) b.onclick = r.on
        else b.disabled = true
        body.append(b)
      }
      body.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    }

    const menu = () => {
      const p = loadProgress(ed)
      win.classList.remove('wide')
      rows([
        { label: '유랑천하 (새로 시작)', img: 'btn-new.png', on: () => { resetProgress(ed); launch(stageDef(1, 0, true)) } },
        { label: '지난흔적 (이어하기)', img: 'btn-load.png', title: p ? `${chapterName(p.next.n, p.next.route)}부터` : '저장된 진행 없음',
          on: p ? () => launch(stageDef(p.next.n, p.next.route, true), p.flags) : undefined },
        { label: '장 선택', on: p?.cleared.length ? chapters : undefined, title: p?.cleared.length ? '클리어한 장 다시 하기' : '클리어한 장이 없음' },
        { label: '제 작 진', on: () => void credits() },
        ...EDITIONS.map(e => ({ label: e.name, cls: `ed ${e.id === ed ? 'on' : ''}`, title: e.desc,
          on: () => { ed = e.id; setLastEdition(ed); menu(); body.querySelector<HTMLButtonElement>('.ed.on')?.focus() } })),
      ])
    }

    // 클리어한 장 다시 하기 (진행 저장에는 영향 없음)
    const chapters = () => {
      const p = loadProgress(ed)!
      const list = [...p.cleared].sort((a, b) => a.n - b.n || a.route - b.route)
      win.classList.add('wide')
      rows([...list.map(c => ({ label: chapterName(c.n, c.route), on: () => launch(stageDef(c.n, c.route), p.flags) })),
        { label: '돌아가기', cls: 'back', on: menu }])
    }

    // 원작 게임종료와 같은 제작진(ECPPLANE 0)·발행(ECPPLANE 1) 화면 + 팬 게임 고지. 클릭·키로 넘긴다
    const credits = async () => {
      win.hidden = true
      for (const html of [`<img src="${A}/ui/staff.png" alt="원작 제작진">`, `<img src="${A}/ui/publish.png" alt="원작 발행 정보">`,
        `<div class="notice"><h2>팬 게임 고지</h2>${NOTICE}</div>`]) {
        page.innerHTML = html
        page.hidden = false
        await waitInput()
      }
      page.hidden = true
      win.hidden = false
      menu()
    }

    const waitInput = () => new Promise<void>(ok => {
      const go = () => { removeEventListener('pointerdown', go); removeEventListener('keydown', go, true); ok() }
      setTimeout(() => { addEventListener('pointerdown', go); addEventListener('keydown', go, true) }, 150)
    })

    // 위·아래 화살표로 항목 이동, Esc 로 돌아가기 (Enter·Space 는 버튼 기본 동작)
    const onKey = (e: KeyboardEvent) => {
      if (win.hidden) return
      const bs = [...body.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      const i = bs.indexOf(document.activeElement as HTMLButtonElement)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]?.focus()
      } else if (e.key === 'Escape' && win.classList.contains('wide')) menu()
    }
    addEventListener('keydown', onKey)

    const showMenu = () => {
      bg.src = `${A}/ui/mark1.png`
      win.hidden = false
      menu()
      stage.classList.remove('dark')
    }

    void (async () => {
      let seen = false
      try { seen = sessionStorage.getItem(INTRO_SEEN) === '1'; sessionStorage.setItem(INTRO_SEEN, '1') } catch { /* 무시 */ }
      if (!seen) await intro(stage, bg)
      showMenu()
    })()
  })
}

/** 로고 연출. 클릭·키를 누르면 바로 끝낸다 */
async function intro(stage: HTMLElement, bg: HTMLImageElement) {
  let skip = false
  const onSkip = () => { skip = true }
  addEventListener('pointerdown', onSkip)
  addEventListener('keydown', onSkip)
  const wait = async (ms: number) => { const t = performance.now() + ms; while (!skip && performance.now() < t) await sleep(Math.min(30, ms)) }
  bg.src = `${A}/ui/mark0.png`
  await bg.decode().catch(() => {})
  const thunder = new Audio(`${A}/ui/thunder.wav`)
  stage.classList.add('cut', 'dark')
  // 원작: 세 번 번쩍 — 켬 10~159ms, 끔 10~309ms, 세 번째 직전에 천둥
  for (let i = 0; i < 3 && !skip; i++) {
    if (i === 2) thunder.play().catch(() => {})   // 자동 재생이 막히면 소리 없이
    stage.classList.remove('dark'); await wait(rand(150) + 10)
    stage.classList.add('dark'); await wait(rand(300) + 10)
  }
  stage.classList.remove('cut')
  if (!skip) { stage.classList.remove('dark'); await wait(4000 + 600) }   // 밝아짐 → 4초
  if (!skip) { stage.classList.add('dark'); await wait(700) }             // 어두워짐
  removeEventListener('pointerdown', onSkip)
  removeEventListener('keydown', onSkip)
  stage.classList.add('dark')
  await sleep(skip ? 300 : 50)   // 건너뛴 클릭이 막 뜬 메뉴 버튼에 떨어지지 않게
}
