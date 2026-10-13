// 타이틀·메인 메뉴 — 원작 124e:e404 재현 (formats.md "메인 메뉴")
// 원작: 돌판 로고(ECPMARK 0)가 세 번 번쩍(세 번째에 천둥) → 밝아져 4초 → 어두워지고 두루마리 노인(ECPMARK 1) 위
// (460,0) 돌 창틀에 유랑천하·지난흔적·게임종료. 게임종료는 제작진·발행 화면(ECPPLANE)을 보여 주고 끝난다.
// 웹: 버튼은 글자 (원작 버튼 그림은 저해상도라 쓰지 않음). 게임종료 자리에 장 선택·제작진(팬 게임 고지 포함)·설정(글꼴·로고 효과음)·판 선택.
// 화면은 640×480 을 통째로 확대
import type { Camp } from './campaign'
import { A } from './data'
import { fadeOut } from './fade'
import { lastEdition, loadProgress, loadSlots, progressCamp, resetProgress, setLastEdition, startOtherRoad, type EditionId } from './save'
import { ROUTE_NAMES, withCarry } from './replay'
import { chapterMap, codex } from './replayScreens'
import { applyFont } from './font'
import { setSetting, setting, type Setting } from './settings'
import { stageDef, type StageDef } from './stage'

export interface Launch { ed: EditionId; def: StageDef; camp?: Camp }  // camp 없음 = 캠페인 밖 기본 상태

const EDITIONS: { id: EditionId; name: string; desc: string }[] = [
  { id: 'original', name: '원작판', desc: '원작 규칙·조작 그대로' },
  { id: 'remake', name: '개선판', desc: '편의 기능, 다듬은 이야기' },
]
const ROUTE = ['A', 'B', 'C']
const chapterName = (n: number, route: number) => stageDef(n, route).title + (n >= 10 ? ` (${ROUTE[route]} 길)` : '')

// 로고 연출은 페이지를 열 때마다. 게임 중 "타이틀로" 로 돌아올 때만 한 번 건너뛴다 (battle.toTitle 이 남김)
export const SKIP_INTRO = 'eclipse.skipIntro'
// 로고 효과음 (천둥, 설정 logoSound): 켜면 원본 음량의 1/2
const THUNDER_VOLUME = 0.5
const SETTINGS: { k: Setting; label: string; title: string }[] = [
  { k: 'bitmapFont', label: '원작 글꼴', title: '원작 비트맵 글꼴로 글자를 그린다 (끄면 시스템 글꼴)' },
  { k: 'logoSound', label: '로고 효과음', title: '시작 로고 연출의 천둥소리' },
]
const thunderAudio = () => { const a = new Audio(`${A}/ui/thunder.wav`); a.volume = THUNDER_VOLUME; return a }

/** 브라우저가 소리 자동 재생을 막는 상태인가. 사용자 입력 전 페이지는 대개 막힌다 (AudioContext 가 suspended 로 시작) */
function autoplayBlocked() {
  if (navigator.userActivation?.hasBeenActive) return false
  try { const c = new AudioContext(), blocked = c.state !== 'running'; void c.close(); return blocked } catch { return false }
}

/** 클릭·키 입력을 기다린다 (소리를 켰는데 자동 재생이 막혔을 때 로고 연출 전에) */
function waitGesture(stage: HTMLElement) {
  return new Promise<void>(ok => {
    const g = document.createElement('div')
    g.className = 'gate'
    g.textContent = '클릭하거나 아무 키나 누르세요'
    stage.append(g)
    const go = () => { g.remove(); removeEventListener('pointerdown', go); removeEventListener('keydown', go); ok() }
    addEventListener('pointerdown', go)
    addEventListener('keydown', go)
  })
}
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
    const launch = (def: StageDef, camp?: Camp) => {
      setLastEdition(ed)
      removeEventListener('resize', fit)
      removeEventListener('keydown', onKey)
      void fadeOut().then(() => {   // 원작처럼 어두워진 뒤 다음 화면 (boot·정비 화면이 밝힌다)
        root.hidden = true
        root.innerHTML = ''
        done({ ed, def, camp })
      })
    }

    // 창 안 항목 (글자 버튼)
    // toggle 이 있으면 켬/끔 스위치 모양 (role=switch)
    type Row = { label: string; on?: () => void; cls?: string; title?: string; toggle?: boolean }
    const rows = (items: Row[]) => {
      body.innerHTML = ''
      for (const r of items) {
        const b = document.createElement('button')
        b.className = `row ${r.cls ?? ''}`
        b.textContent = r.label
        if (r.toggle !== undefined) {
          b.setAttribute('role', 'switch')
          b.setAttribute('aria-checked', String(r.toggle))
          b.insertAdjacentHTML('beforeend', '<i class="switch" aria-hidden="true"></i>')
        }
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
        { label: '유랑천하', title: '새로 시작', on: () => { resetProgress(ed); launch(stageDef(1, 0, true), { flags: [], party: [], items: [] }) } },
        { label: '지난흔적', title: p || loadSlots(ed).some(Boolean) ? '이어하기·기록 불러오기' : '저장된 진행 없음',
          on: p || loadSlots(ed).some(Boolean) ? () => loadMenu() : undefined },
        ...ed === 'remake' ? [   // 개선판: 장 지도·다른 길로·도감 (replay-design.md)
          { label: '장 지도', on: p?.cleared.length ? () => void openMap() : undefined, title: p?.cleared.length ? '가 본 장과 찾은 사건, 다시 하기' : '클리어한 장이 없음' },
          ...p?.endings?.length && p.branch ? [{ label: '다른 길로', title: '진로 선택 직전에서 다른 길로 (장비·도감 이어받기)', on: otherRoad }] : [],
          { label: '도    감', on: p?.seen ? () => void openCodex() : undefined, title: p?.seen ? '만난 인물·손에 넣은 도구' : '기록 없음' },
        ] : [{ label: '장 선택', on: p?.cleared.length ? chapters : undefined, title: p?.cleared.length ? '클리어한 장 다시 하기' : '클리어한 장이 없음' }],
        { label: '제 작 진', on: () => credits(0) },
        { label: '설 정', title: '글꼴·효과음', on: () => settings() },
        ...EDITIONS.map(e => ({ label: e.name, cls: `ed ${e.id === ed ? 'on' : ''}`, title: e.desc,
          on: () => { ed = e.id; setLastEdition(ed); menu(); body.querySelector<HTMLButtonElement>('.ed.on')?.focus() } })),
      ])
    }

    // 설정: 켬/끔 스위치들 (두 판 공통). 바꾸면 그 자리에 초점을 둔 채 다시 그린다
    const settings = (focus = 0) => {
      win.classList.add('wide')
      rows([...SETTINGS.map(o => ({ label: o.label, cls: 'opt', toggle: setting(o.k), title: o.title,
        on: () => { setSetting(o.k, !setting(o.k)); applyFont(); settings(SETTINGS.indexOf(o)) } })),
        { label: '돌아가기', cls: 'back', on: menu }])
      body.querySelectorAll<HTMLButtonElement>('.opt')[focus]?.focus()
    }

    // 지난흔적: 자동 기록 (장을 마칠 때마다) + 정비 화면 기록 3칸 (원작 「불러오기」)
    const loadMenu = () => {
      const p = loadProgress(ed)
      win.classList.add('wide')
      rows([
        { label: p ? `이어하기 · ${chapterName(p.next.n, p.next.route)}` : '이어하기 (없음)', title: '장을 마칠 때마다 자동 기록',
          on: p ? () => launch(stageDef(p.next.n, p.next.route, true), progressCamp(p)) : undefined },
        ...loadSlots(ed).map((s, i) => ({ label: s ? `기록 ${i + 1} · ${s.title}` : `기록 ${i + 1} · 무기록`, title: s ? new Date(s.at).toLocaleString() : '',
          on: s ? () => launch(stageDef(s.n, s.route, true), s.camp) : undefined })),
        { label: '돌아가기', cls: 'back', on: menu }])
    }

    // 클리어한 장 다시 하기 (진행 저장에는 영향 없음)
    const chapters = () => {
      const p = loadProgress(ed)!
      const list = [...p.cleared].sort((a, b) => a.n - b.n || a.route - b.route)
      win.classList.add('wide')
      rows([...list.map(c => ({ label: chapterName(c.n, c.route), on: () => launch(stageDef(c.n, c.route), c.at) })),
        { label: '돌아가기', cls: 'back', on: menu }])
    }

    // 다른 길로: 분기점 상태 + 마지막 엔딩의 장비로 고른 루트의 첫 장부터 (이어하기도 그 판으로)
    const otherRoad = () => {
      const p = loadProgress(ed)!
      win.classList.add('wide')
      rows([...[0, 1, 2].map(r => ({ label: `${ROUTE[r]} · ${ROUTE_NAMES[r]}${p.endings?.includes(r) ? ' ✓' : ''}`,
        title: p.endings?.includes(r) ? '엔딩을 본 길' : '아직 엔딩을 보지 못한 길',
        on: () => { const camp = withCarry(p.branch!, p.carry); const next = startOtherRoad(ed, r, camp); if (next) launch(stageDef(next.n, r, true), camp) } })),
        { label: '돌아가기', cls: 'back', on: menu }])
    }

    // 장 지도·도감 (개선판). page 를 쓰고 Esc·돌아가기로 메뉴로
    const openPage = () => { pageAt = -2; win.hidden = true; page.hidden = false }
    const openMap = async () => {
      openPage()
      await chapterMap(page, loadProgress(ed), c => launch(stageDef(c.n, c.route), c.at),
        n => launch(stageDef(n, 0), { flags: [], party: [], items: [] }), closeCredits)   // 숨은 장: 일행은 그 장 데이터가 정한다
    }
    const openCodex = async () => { openPage(); await codex(page, loadProgress(ed), closeCredits) }

    // 원작 게임종료와 같은 제작진(ECPPLANE 0)·발행(ECPPLANE 1) 화면 + 팬 게임 고지. 이전·다음으로 넘긴다
    const PAGES = [`<img src="${A}/ui/staff.png" alt="원작 제작진">`, `<img src="${A}/ui/publish.png" alt="원작 발행 정보">`,
      `<div class="notice"><h2>팬 게임 고지</h2>${NOTICE}</div>`]
    let pageAt = -1
    const credits = (i: number) => {
      pageAt = i
      win.hidden = true
      page.hidden = false
      page.innerHTML = `${PAGES[i]}<nav>
          <button data-go="-1" ${i === 0 ? 'disabled' : ''}>◀ 이전</button>
          <span>${i + 1} / ${PAGES.length}</span>
          <button data-go="1" ${i === PAGES.length - 1 ? 'disabled' : ''}>다음 ▶</button>
          <button data-go="0" class="close">돌아가기</button>
        </nav>`
      page.querySelectorAll<HTMLButtonElement>('nav button').forEach(b => b.onclick = () => {
        const d = Number(b.dataset.go)
        if (d) credits(pageAt + d)
        else closeCredits()
      })
      page.querySelector<HTMLButtonElement>(`nav button[data-go="${i === PAGES.length - 1 ? 0 : 1}"]`)?.focus()
    }
    const closeCredits = () => {
      pageAt = -1
      page.hidden = true
      win.hidden = false
      menu()
    }

    // 메뉴: 위·아래 화살표로 항목 이동, Esc 로 돌아가기. 제작진: 좌·우 화살표로 이전·다음, Esc 로 돌아가기
    const onKey = (e: KeyboardEvent) => {
      if (pageAt === -2) { if (e.key === 'Escape') closeCredits(); return }   // 장 지도·도감
      if (pageAt >= 0) {
        if (e.key === 'ArrowLeft' && pageAt > 0) credits(pageAt - 1)
        else if (e.key === 'ArrowRight' && pageAt < PAGES.length - 1) credits(pageAt + 1)
        else if (e.key === 'Escape') closeCredits()
        return
      }
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
      let skip = false
      try { skip = sessionStorage.getItem(SKIP_INTRO) === '1'; sessionStorage.removeItem(SKIP_INTRO) } catch { /* 무시 */ }
      if (!skip) await intro(stage, bg)
      else { stage.classList.add('cut', 'dark'); void stage.offsetWidth; stage.classList.remove('cut') }   // 타이틀로 돌아올 때도 밝아지며
      showMenu()
    })()
  })
}

/** 로고 연출. 클릭·키를 누르면 바로 끝낸다 */
async function intro(stage: HTMLElement, bg: HTMLImageElement) {
  const thunder = setting('logoSound') ? thunderAudio() : null
  if (thunder && autoplayBlocked()) await waitGesture(stage)   // 막힌 채 재생하면 소리 없이 지나간다
  let skip = false, skipNow = () => {}
  const skipped = new Promise<void>(ok => { skipNow = ok })
  const onSkip = () => { skip = true; skipNow() }
  addEventListener('pointerdown', onSkip)
  addEventListener('keydown', onSkip)
  const wait = (ms: number) => skip ? Promise.resolve() : Promise.race([sleep(ms), skipped])
  // decode() 는 숨은 탭에서 끝나지 않을 수 있어 load 이벤트로 (최대 2초)
  const loaded = new Promise<void>(ok => { bg.onload = bg.onerror = () => ok() })
  bg.src = `${A}/ui/mark0.png`
  await Promise.race([loaded, sleep(2000)])
  stage.classList.add('cut', 'dark')
  // 원작: 세 번 번쩍 — 켬 10~159ms, 끔 10~309ms, 세 번째 직전에 천둥
  for (let i = 0; i < 3 && !skip; i++) {
    if (i === 2) thunder?.play().catch(() => {})   // 자동 재생이 막히면 소리 없이
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
