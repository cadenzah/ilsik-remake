// 타이틀·메인 메뉴 — 원작 124e:e404 재현 (formats.md "메인 메뉴")
// 원작: 켜면 창세 프롤로그 (2ff8:04dc, movie.ts) → 돌판 로고(ECPMARK 0)가 세 번 번쩍(세 번째에 천둥) → 밝아져 4초 → 어두워지고 두루마리 노인(ECPMARK 1) 위
// (460,0) 돌 창틀에 유랑천하·지난흔적·게임종료. 게임종료는 제작진·발행 화면(ECPPLANE)을 보여 주고 끝난다.
// 웹: 버튼은 글자 (원작 버튼 그림은 저해상도라 쓰지 않음). 게임종료 자리에 제작진(팬 게임 고지 포함)·판 선택. 개선판만 장 지도·도감·설정 (글꼴·화면·편의·기록 옮기기).
// 화면은 640×480 을 통째로 확대
import type { Camp } from './campaign'
import { A } from './data'
import { fadeIn, fadeOut } from './fade'
import { prologue } from './movie'
import { applyBundle, bundleCode, currentBundle, hasImportBackup, lastEdition, loadProgress, loadSlots, loadSuspended, parseTransfer, progressCamp, resetProgress,
  setLastEdition, startOtherRoad, undoImport, type EditionId, type Progress, type SaveBundle, type SaveSlot, type Suspended } from './save'
import { ROUTE_NAMES, withCarry } from './replay'
import { chapterMap, codex } from './replayScreens'
import { applyFont } from './font'
import { busy, imgReady, pageReady } from './loading'
import { SONG, playMusic, stopMusic } from './music'
import { VOLUME_KINDS, volumeRow } from './volumeUi'
import { DIFFICULTIES, DIFF_DESC, SETTINGS, difficulty, lowestDifficulty, nextDifficulty, setDifficulty, setSetting, setting, volumeGain, type Difficulty } from './settings'
import { stageDef, type StageDef } from './stage'

export interface Launch { ed: EditionId; def: StageDef; camp?: Camp; resume?: Suspended }  // camp 없음 = 캠페인 밖 기본 상태, resume = 전투 중 저장 (중간 저장)

const EDITIONS: { id: EditionId; name: string }[] = [
  { id: 'original', name: '원작판' },
  { id: 'remake', name: '개선판' },
]
const ROUTE = ['A', 'B', 'C']
const chapterName = (n: number, route: number) => stageDef(n, route).title + (n >= 10 ? ` (${ROUTE[route]} 길)` : '')

// 창세 프롤로그·로고 연출은 페이지를 열 때마다 (원작은 프로그램을 켤 때). 게임 중 "타이틀로" 로 돌아올 때만 한 번 건너뛴다 (battle.toTitle 이 남김)
export const SKIP_INTRO = 'eclipse.skipIntro'
// 로고 효과음 (천둥, 설정 logoSound): 켜면 원본 음량의 1/2
const THUNDER_VOLUME = 0.5
// 메인 메뉴에서 이만큼 입력이 없으면 오프닝을 다시 튼다 (원작에는 없는 웹 추가 기능)
const IDLE_MS = 60_000
const IDLE_INPUTS = ['pointerdown', 'pointermove', 'keydown', 'wheel']
const thunderAudio = () => { const a = new Audio(`${A}/ui/thunder.wav`); a.volume = THUNDER_VOLUME * volumeGain('sound'); return a }

/** 브라우저가 소리 자동 재생을 막는 상태인가. 사용자 입력 전 페이지는 대개 막힌다 (AudioContext 가 suspended 로 시작) */
function autoplayBlocked() {
  if (navigator.userActivation?.hasBeenActive) return false
  try { const c = new AudioContext(), blocked = c.state !== 'running'; void c.close(); return blocked } catch { return false }
}

/** 클릭·키 입력을 기다린다 (소리를 켰는데 자동 재생이 막혔을 때 프롤로그·로고 연출 전에) */
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
const REPO = 'https://github.com/cadenzah/ilsik-remake'
const FEEDBACK = `
  <p>버그나 바라는 기능은<br>아래 저장소의 이슈로 남겨 주세요.</p>
  <p><a href="${REPO}/issues" target="_blank" rel="noopener">github.com/cadenzah/ilsik-remake</a></p>
  <p class="dim">판, 장, 상황과 화면 갈무리를 함께 적어 주시면<br>도움이 됩니다.</p>
  <p class="dim">버전 ${__VERSION__}</p>`

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
    const launch = (def: StageDef, camp?: Camp, resume?: Suspended) => {
      setLastEdition(ed)
      removeEventListener('resize', fit)
      removeEventListener('keydown', onKey)
      clearTimeout(idleTimer)
      for (const t of IDLE_INPUTS) removeEventListener(t, armIdle, true)
      void fadeOut().then(() => {   // 원작처럼 어두워진 뒤 다음 화면 (boot·정비 화면이 밝힌다)
        root.hidden = true
        root.innerHTML = ''
        done({ ed, def, camp, resume })
      })
    }

    // 창 안 항목 (글자 버튼)
    // toggle 이 있으면 켬/끔 스위치 모양 (role=switch)
    // sub 가 있으면 두 줄 (위 = 항목, 아래 = 작은 글자 장 이름 등. 넘치면 … 으로 자른다)
    type Row = { label: string; sub?: string; on?: () => void; cls?: string; title?: string; toggle?: boolean }
    const rows = (items: Row[]) => {
      body.innerHTML = ''
      for (const r of items) {
        const b = document.createElement('button')
        b.className = `row ${r.cls ?? ''}`
        b.textContent = r.label
        if (r.sub !== undefined) {
          b.classList.add('two')
          const small = document.createElement('small')
          small.textContent = r.sub
          b.append(small)
        }
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
      applyFont(ed === 'original' || undefined)   // 원작판은 늘 원작 글꼴 (설정은 개선판 메뉴에만)
      win.classList.remove('wide', 'pick', 'back')
      rows([
        { label: '유랑천하', on: () => ed === 'remake' ? pickDifficulty() : newGame() },
        { label: '지난흔적', on: () => loadMenu() },
        ...ed === 'remake' ? [   // 개선판: 장 지도·다른 길로·도감 (replay-design.md)
          { label: '장 지도', on: p?.cleared.length ? () => void openMap() : undefined },
          ...p?.endings?.length && p.branch ? [{ label: '다른 길로', on: otherRoad }] : [],
          { label: '도    감', on: () => void openCodex() },   // 처음부터 열림 (도움말 탭)
          { label: '설 정', on: () => settings() },
        ] : [],   // 원작판: 원작 메뉴 (유랑천하·지난흔적) 그대로. 장 선택·설정 같은 웹 편의는 개선판에만
        { label: '제 작 진', on: () => credits(0) },
        // 판 바꾸기 = 판 고르기 창 (두 판 설명을 보고 바꾼다. 2026-11-07 사용자: 처음 방문 때만 뜨면 이미 해 본 사람은 볼 길이 없다)
        { label: '판 바꾸기', cls: 'edsw', on: () => pickEdition() },
      ])
      // 어느 판인지는 맨 아래 버전 줄에 판 이름으로 (「개선판 v1.0.0」). 「지금 ○○판」 같은 설명 글은 쓰지 않는다 (2026-11-07 사용자)
      body.insertAdjacentHTML('beforeend', `<div class="version">${EDITIONS.find(e => e.id === ed)!.name} ${__VERSION__.split(' ')[0]}</div>`)
      mainMark = body.firstElementChild   // 대기 화면 (attract) 은 이 첫 줄이 그대로 보일 때만 — 하위 창은 body 를 갈아 끼운다
    }
    let mainMark: Element | null = null

    // 판 고르기 창: 메뉴 맨 아래 「판 바꾸기」. 지금 판 카드에 ◆, 돌아가기·Esc. 판마다 카드 한 장
    // 첫 실행에는 띄우지 않는다 (2026-11-08 사용자): 처음 하는 사람에겐 고를 근거가 없는 질문이라 개선판 메뉴로 바로 가고, 원작판을 찾는 사람은 이 창으로
    // 카드 문구 (2026-11-08 사용자): 개선판은 대사 + 새 규칙·메커니즘 한 줄 + 편의 기능·UI 한 줄. 규칙 이름을 늘어놓거나 하나하나 풀어 쓰지 않는다.
    // 원작판 = 원작 그대로 + 편의는 개선판에서 꼭 필요한 것만 옮겼다는 취지 (창 닫기 ✕·대화 기록·확대 등, ux.md 5·8절)
    const pickEdition = () => {
      applyFont(undefined)
      win.classList.remove('wide')
      win.classList.add('pick', 'back')
      const card = (id: EditionId, name: string, lines: string[], who: string) =>
        `<button class="edcard${id === ed ? ' now' : ''}" data-ed="${id}"><span class="n">${name}</span>${lines.map(l => `<span class="l">${l}</span>`).join('')}<span class="who">${who}</span></button>`
      body.innerHTML = `<div class="ask">판 바꾸기</div>
        ${card('remake', '개선판', ['현대어로 새로 쓴 대사', '게임 양상을 다채롭게 만드는 새 규칙과 메커니즘', '플레이를 편하게 하는 편의 기능과 UI 개선'], '처음 하는 분, 새롭게 즐기고 싶은 분')}
        ${card('original', '원작판', ['1996년 원작의 규칙과 대사', '개선판에서 옮겨 온 최소한의 편의 기능'], '원작을 그대로 다시 해 보고 싶은 분')}`
      const b = document.createElement('button')
      b.className = 'row back'
      b.textContent = '돌아가기'
      b.onclick = () => menu()
      body.append(b)
      body.querySelectorAll<HTMLButtonElement>('.edcard').forEach(b => b.onclick = () => {
        ed = b.dataset.ed as EditionId
        setLastEdition(ed)
        menu()
      })
      body.querySelector<HTMLButtonElement>('.edcard.now')?.focus()
    }

    const newGame = () => { resetProgress(ed); launch(stageDef(1, 0, true), { flags: [], party: [], items: [] }) }
    // 개선판 새로 시작: 난이도부터 (설정에서 언제든 바꿀 수 있다)
    const pickDifficulty = () => {
      win.classList.add('wide')
      const seenEnd = !!loadProgress(ed)?.endings?.length   // 엔딩을 본 적이 있으면 시스템 안내 (tips.ts) 를 볼지 묻는다 (기본 끔)
      rows([...([0, 1, 2] as Difficulty[]).map(d => ({ label: DIFFICULTIES[d],
        on: () => { setDifficulty(d); if (seenEnd) askTips(); else newGame() } })),
        { label: '돌아가기', cls: 'back', on: menu }])
      body.querySelectorAll<HTMLButtonElement>('button')[difficulty()]?.focus()
    }
    const askTips = () => {
      const pick = (on: boolean) => () => { setSetting('tipLines', on); setSetting('tipCards', on); newGame() }
      rows([{ label: '안내 없이 시작', title: '새 규칙을 처음 겪을 때의 동료 한마디·안내 카드를 끈다 (설정에서 다시 켤 수 있다)', on: pick(false) },
        { label: '안내 보며 시작', title: '새 규칙을 처음 겪을 때 동료 한마디와 안내 카드', on: pick(true) },
        { label: '돌아가기', cls: 'back', on: pickDifficulty }])
    }
    /** 기록 칸 글자 뒤에 붙일 그 판의 가장 낮은 난이도 (개선판) */
    const lowest = (flags: string[]) => { const d = ed === 'remake' ? lowestDifficulty(flags) : undefined; return d === undefined ? '' : ` · ${DIFFICULTIES[d]}` }

    // 설정 (개선판 메뉴): 켬/끔 스위치들 + 난이도 + 기록 옮기기. 바꾸면 그 자리에 초점을 둔 채 다시 그린다
    const settings = (focus = 0) => {
      win.classList.add('wide')
      rows([...SETTINGS.map(o => ({ label: o.label, cls: 'opt', toggle: setting(o.k), title: o.desc,
        on: () => { setSetting(o.k, !setting(o.k)); applyFont(); settings(SETTINGS.indexOf(o)) } })),
        { label: `난이도 · ${DIFFICULTIES[difficulty()]}`, cls: 'opt', title: DIFF_DESC, on: () => { nextDifficulty(); settings(SETTINGS.length) } },
        { label: '기록 옮기기', on: () => void openTransfer() },
        { label: '돌아가기', cls: 'back', on: menu }])
      const bs = body.querySelectorAll<HTMLButtonElement>('button')
      for (const k of VOLUME_KINDS) bs[SETTINGS.findIndex(o => o.k === k)].after(volumeRow(k, 'row opt vol'))
      bs[focus]?.focus()
    }

    // 지난흔적: 자동 기록 (장을 마칠 때마다) + 정비 화면 기록 3칸 (원작 「불러오기」)
    const loadMenu = () => {
      const p = loadProgress(ed), sus = loadSuspended(ed)
      win.classList.add('wide')
      rows([
        ...sus ? [{ label: '전투 중 저장', sub: `${sus.title} · ${sus.turn}턴`, title: new Date(sus.saved).toLocaleString(),
          on: () => launch(sus.def, sus.at, sus) }] : [],
        { label: '이어하기', sub: p ? chapterName(p.next.n, p.next.route) + lowest(p.flags) : '없음',
          on: p ? () => launch(stageDef(p.next.n, p.next.route, true), progressCamp(p)) : undefined },
        ...loadSlots(ed).map((s, i) => ({ label: `기록 ${i + 1}`, sub: s ? s.title + lowest(s.camp.flags) : '무기록', title: s ? `${s.title}\n${new Date(s.at).toLocaleString()}` : '',
          on: s ? () => launch(stageDef(s.n, s.route, true), s.camp) : undefined })),
        { label: '돌아가기', cls: 'back', on: menu }])
    }

    // 기록 옮기기 (save.ts): 보내기 = 코드 복사·파일 저장, 받기 = 코드 붙여넣기·파일 열기 → 내용 확인 → 덮어쓰기 (한 번 되돌리기)
    const summary = (b: SaveBundle) => EDITIONS.map(e => {
      const d = b.data, p = d[`eclipse.progress.${e.id}`] as Progress | undefined, s = d[`eclipse.suspend.${e.id}`] as Suspended | undefined
      const n = (d[`eclipse.slots.${e.id}`] as (SaveSlot | null)[] | undefined)?.filter(Boolean).length ?? 0
      const parts = [p ? `이어하기 ${chapterName(p.next.n, p.next.route)}` : '', n ? `기록 ${n}칸` : '', s ? '전투 중 저장' : ''].filter(Boolean)
      return `<li><b>${e.name}</b> ${parts.join(' · ') || '<span class="dim">없음</span>'}</li>`
    }).join('')
    const openTransfer = async (note = '') => {
      openPage(() => settings(SETTINGS.length + 1))
      const mine = currentBundle(), has = Object.keys(mine.data).length > 0
      const code = has ? await bundleCode(mine) : ''
      page.innerHTML = `<div class="transfer">
          <h2>기록 옮기기</h2>
          <p class="lead">진행 기록을 다른 브라우저나 기기로 옮깁니다.</p>
          <section><h3>보내기</h3><ul>${summary(mine)}</ul>
            <textarea class="out" readonly spellcheck="false" placeholder="옮길 기록이 없습니다"></textarea>
            <div class="btns"><button data-act="copy" ${has ? '' : 'disabled'}>코드 복사</button><button data-act="save" ${has ? '' : 'disabled'}>파일로 저장</button></div>
            <p class="msg out-msg"></p></section>
          <section><h3>받기</h3>
            <textarea class="in" spellcheck="false" placeholder="코드를 붙여 넣거나 파일을 여세요"></textarea>
            <div class="btns"><button data-act="open">파일 열기</button><button data-act="read">가져오기</button></div>
            <p class="msg in-msg"></p></section>
        </div>
        <nav>${hasImportBackup() ? '<button data-act="undo">가져오기 전으로</button>' : ''}
          <button data-act="close" class="close">돌아가기</button></nav>`
      const $ = <T extends HTMLElement>(q: string) => page.querySelector<T>(q)!
      const out = $<HTMLTextAreaElement>('.out'), inp = $<HTMLTextAreaElement>('.in'), outMsg = $('.out-msg'), inMsg = $('.in-msg'), read = $<HTMLButtonElement>('[data-act="read"]')
      out.value = code
      inMsg.innerHTML = note
      let pending: SaveBundle | null = null
      const reset = () => { pending = null; read.textContent = '가져오기'; read.classList.remove('warn') }
      const check = async () => {
        try {
          pending = await parseTransfer(inp.value)
          inMsg.innerHTML = `<ul>${summary(pending)}</ul>${new Date(pending.at).toLocaleString()} 기록으로 덮어씁니다.`
          read.textContent = '덮어쓰기'
          read.classList.add('warn')
        } catch (err) { reset(); inMsg.innerHTML = `<span class="err">${(err as Error).message}</span>` }
      }
      inp.oninput = () => { reset(); inMsg.textContent = '' }
      const file = document.createElement('input')
      file.type = 'file'
      file.accept = '.json,.txt,application/json,text/plain'
      file.onchange = async () => { const f = file.files?.[0]; if (!f) return; inp.value = await f.text(); await check() }
      const acts: Record<string, () => void | Promise<void>> = {
        copy: async () => {
          try { await navigator.clipboard.writeText(code) } catch { out.select(); document.execCommand('copy') }
          outMsg.textContent = '복사했습니다.'
        },
        save: () => {
          const a = document.createElement('a'), d = new Date(), pad = (n: number) => String(n).padStart(2, '0')
          a.href = URL.createObjectURL(new Blob([JSON.stringify(mine, null, 1)], { type: 'application/json' }))
          a.download = `eclipse-save-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`
          a.click()
          setTimeout(() => URL.revokeObjectURL(a.href), 1000)
          outMsg.textContent = '파일로 저장했습니다.'
        },
        open: () => file.click(),
        read: async () => {
          if (!pending) { await check(); return }
          try { applyBundle(pending); await openTransfer('가져왔습니다.') } catch (err) { inMsg.innerHTML = `<span class="err">${(err as Error).message}</span>` }
        },
        undo: async () => { undoImport(); await openTransfer('가져오기 전 기록으로 되돌렸습니다.') },
        close: () => closeCredits(pageBack),
      }
      page.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach(b => b.onclick = () => void acts[b.dataset.act!]())
    }

    // 다른 길로: 분기점 상태 + 마지막 엔딩의 장비로 고른 루트의 첫 장부터 (이어하기도 그 판으로)
    const otherRoad = () => {
      const p = loadProgress(ed)!
      win.classList.add('wide')
      rows([...[0, 1, 2].map(r => ({ label: `${ROUTE[r]} · ${ROUTE_NAMES[r]}${p.endings?.includes(r) ? ' ✓' : ''}`,
        on: () => { const camp = withCarry(p.branch!, p.carry); const next = startOtherRoad(ed, r, camp); if (next) launch(stageDef(next.n, r, true), camp) } })),
        { label: '돌아가기', cls: 'back', on: menu }])
    }

    // 장 지도·도감 (개선판). page 를 쓰고 Esc·돌아가기로 메뉴로
    let pageBack = () => menu()   // 장 지도·도감·기록 옮기기에서 돌아갈 메뉴
    const openPage = (back = menu) => { pageAt = -2; pageBack = back; win.hidden = true; page.hidden = false }
    const openMap = async () => {
      openPage()
      await chapterMap(page, loadProgress(ed), c => launch(stageDef(c.n, c.route), c.at),
        n => launch(stageDef(n, 0), { flags: [], party: [], items: [] }), closeCredits)   // 숨은 장: 일행은 그 장 데이터가 정한다
    }
    const openCodex = async () => { openPage(); await codex(page, loadProgress(ed), closeCredits) }

    // 원작 게임종료와 같은 제작진(ECPPLANE 0)·발행(ECPPLANE 1) 화면 + 팬 게임 고지 + 제보·제안 안내. 이전·다음으로 넘긴다
    const PAGES = [`<img src="${A}/ui/staff.png" alt="원작 제작진">`, `<img src="${A}/ui/publish.png" alt="원작 발행 정보">`,
      `<div class="notice"><h2>팬 게임 고지</h2>${NOTICE}</div>`, `<div class="notice"><h2>버그 제보 · 기능 제안</h2>${FEEDBACK}</div>`]
    let pageAt = -1
    const credits = (i: number) => {
      pageAt = i
      playMusic(SONG.credits)   // 원작 제작진 소개 (0aa2:3384) 곡
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
    const closeCredits = (then = menu) => {
      pageAt = -1
      stopMusic()   // 메인 메뉴는 무음
      page.hidden = true
      win.hidden = false
      then()
    }

    // 메뉴: 위·아래 화살표로 항목 이동, Esc 로 돌아가기. 제작진: 좌·우 화살표로 이전·다음, Esc 로 돌아가기
    const onKey = (e: KeyboardEvent) => {
      if (pageAt === -2) { if (e.key === 'Escape') closeCredits(pageBack); return }   // 장 지도·도감·기록 옮기기
      if (pageAt >= 0) {
        if (e.key === 'ArrowLeft' && pageAt > 0) credits(pageAt - 1)
        else if (e.key === 'ArrowRight' && pageAt < PAGES.length - 1) credits(pageAt + 1)
        else if (e.key === 'Escape') closeCredits()
        return
      }
      if (win.hidden) return
      const bs = [...body.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')]   // input = 설정의 음량 (좌우로 바꾼다)
      const i = bs.indexOf(document.activeElement as HTMLElement)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]?.focus()
      } else if (e.key === 'Escape' && (win.classList.contains('wide') || win.classList.contains('back'))) menu()
    }
    addEventListener('keydown', onKey)

    const showMenu = async () => {
      bg.src = `${A}/ui/mark1.png`
      win.hidden = false
      menu()   // 처음 방문도 메뉴로 (판을 고른 적이 없으면 lastEdition = 개선판)
      await busy(pageReady(stage))   // 첫 실행: 배경·창틀 그림과 글꼴이 오기 전에 밝히지 않는다
      stage.classList.remove('dark')
    }

    // 대기 화면: 메인 메뉴 첫 화면에서만 입력이 없으면 프롤로그 → 로고 → 메뉴. 다시 대기하면 또 튼다.
    // 하위 창 (난이도·지난흔적·설정·판 바꾸기·안내 묻기 등)·제작진·장 지도·도감 에서는 틀지 않는다 (2026-11-08 사용자). onMain = 메뉴 첫 줄이 화면에 있음
    // 프롤로그 중 누르면 로고 없이 바로 메뉴로. 숨은 탭에서는 틀지 않는다 (받을 것이 크다)
    let idleTimer = 0, attracting = false
    const armIdle = () => {
      clearTimeout(idleTimer)
      if (!attracting) idleTimer = window.setTimeout(() => void attract(), IDLE_MS)
    }
    const attract = async () => {
      const onMain = !win.hidden && pageAt === -1 && !!mainMark && body.contains(mainMark) && !win.classList.contains('wide') && !win.classList.contains('pick')
      if (document.hidden || !onMain) { armIdle(); return }
      attracting = true
      win.inert = true   // 어두워지는 동안 초점 단추에 키가 들어가지 않게
      await fadeOut()
      win.hidden = true
      const skipped = await prologue()
      stage.classList.add('cut', 'dark')
      await fadeIn(0)
      if (skipped) { void stage.offsetWidth; stage.classList.remove('cut') }
      else await intro(stage, bg)
      win.inert = false
      attracting = false
      void showMenu()
      armIdle()
    }
    for (const t of IDLE_INPUTS) addEventListener(t, armIdle, true)   // 캡처: 프롤로그가 입력을 막아도 먼저 받는다 (재생 중이면 attracting 이 거른다)

    void (async () => {
      let skip = false
      try { skip = sessionStorage.getItem(SKIP_INTRO) === '1'; sessionStorage.removeItem(SKIP_INTRO) } catch { /* 무시 */ }
      if (!skip) {
        // 소리를 켰는데 자동 재생이 막혔으면 맨 앞에서 입력을 받는다 (막힌 채 재생하면 천둥이 소리 없이 지나간다)
        if (setting('logoSound') && autoplayBlocked()) await waitGesture(stage)
        await prologue()   // 어둡게 끝난다 → 로고가 어두운 데서 시작하도록 무대를 먼저 가리고 막을 걷는다
        stage.classList.add('cut', 'dark')
        await fadeIn(0)
        await intro(stage, bg)
      }
      else { stage.classList.add('cut', 'dark'); void stage.offsetWidth; stage.classList.remove('cut') }   // 타이틀로 돌아올 때도 밝아지며
      void showMenu()
      armIdle()
    })()
  })
}

/** 로고 연출. 클릭·키를 누르면 바로 끝낸다 */
async function intro(stage: HTMLElement, bg: HTMLImageElement) {
  const thunder = setting('logoSound') ? thunderAudio() : null
  let skip = false, skipNow = () => {}
  const skipped = new Promise<void>(ok => { skipNow = ok })
  const onSkip = () => { skip = true; skipNow() }
  addEventListener('pointerdown', onSkip)
  addEventListener('keydown', onSkip)
  const wait = (ms: number) => skip ? Promise.resolve() : Promise.race([sleep(ms), skipped])
  // decode() 는 숨은 탭에서 끝나지 않을 수 있어 load 이벤트로 (최대 2초)
  const loaded = new Promise<void>(ok => { bg.onload = bg.onerror = () => ok() })
  bg.src = `${A}/ui/mark0.png`
  void imgReady(`${A}/ui/mark1.png`)   // 로고 동안 메뉴 배경도 받아 둔다
  await busy(Promise.race([loaded, sleep(8000)]))
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
