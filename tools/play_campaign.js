// 캠페인 빠른 자동 진행 (개발 서버 페이지에서). 실제 화면 흐름 그대로 장면·정비·레벨업·회상을 지나 다음 장으로 간다.
//   await import('/tools/play_campaign.js') — 불러올 때 localStorage 를 떠 둔다 (새로 시작하기 전에 불러올 것)
//   (타이틀 → 새로 시작 → 난이도)  await __play.start({ stopAt: 16, guard: { 5: '루이스' }, guardLeadFrom: 8 })   — 지금 화면부터, 진행은 백그라운드
//   __play.status()                         — 장·승패·회상·승급 제안 요약
//   __play.stop(); __play.restore()         — 멈춤 / 시작 전 localStorage (설정·진행·기록) 로 되돌리고 새로 고침
// 일행: 개선판 AI (planFor) 로 칠 대상이 있으면 치고 (quickAttack 으로 이동+공격), 없으면 적까지 길 거리 (유닛 무시) 가 가장 가까운 칸으로 간다.
//   호위 NPC 가 있으면 그 둘레 3칸 안의 적부터. 선두는 적에서 7칸쯤 뒤를 따라가고 생명 45% 아래면 치지 않는다. 생명 낮은 대원은 쉬게 둔다 (턴 끝 자동 휴식)
// 대사 = Esc, 레벨업 창 = 「승급」 (없으면 「확인」), 안내 카드 = 「닫기」 (status 의 tips), 결과 창 = 「다음 장」 → 「다시 하기」, 그 밖 확인·진로선택·목표 창 = 첫 버튼, 정비 화면 = 출전.
// 빠르게: setTimeout 대기를 speed 배 (기본 0.3), 설정 quickAttack·fastEnemy·shortAnim 을 켠다 (시작 전 값은 restore 로).
// 한계: 진형·호위·선두 보호가 약하다 → guard = { 장: '선두' | 유닛 이름 }·guardLeadFrom = 장 이면 그 장 (부터) 전투 동안 그 유닛 생명을 300 으로 (시험 보조, status 에 남김).
//   2026-11-06 1~12장 약 20분, 5장 루이스·8장부터 선두에 guard 가 필요했다. 1장부터 하려면 타이틀 → 새로 시작 → 난이도를 고른 뒤 start
const BACKUP = 'play.backup'
const P = window.__play = window.__play ?? {}

/** 시작 전 localStorage (eclipse.*) 를 한 번만 떠 둔다. 불러올 때 바로 — 타이틀에서 새로 시작하면 진행 기록이 덮어써지므로 그 전에 */
P.backup = function () {
  if (localStorage.getItem(BACKUP)) return
  const bk = {}
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('eclipse.')) bk[k] = localStorage.getItem(k) }
  localStorage.setItem(BACKUP, JSON.stringify(bk))
}
P.backup()

P.start = async function (opt = {}) {
  P.stop?.()
  const { stopAt = 99, speed = 0.3, guard = {}, guardLeadFrom = Infinity } = opt
  P.backup()
  for (const [k, v] of Object.entries({ quickAttack: '1', fastEnemy: '1', shortAnim: '1', sound: '0', music: '0' })) localStorage.setItem(`eclipse.${k}`, v)
  const oST = P.oST ??= window.setTimeout.bind(window)
  window.setTimeout = (f, ms, ...a) => oST(f, Math.max(0, (ms || 0) * speed), ...a)

  const [B, DL, G, { S }] = await Promise.all([import('/src/core/battle.ts'), import('/src/core/dialogue.ts'), import('/src/core/grid.ts'), import('/src/core/state.ts')])
  const planFor = (u) => S.ed.planFor(S.map, S.units, u, S.troopState)
  const D = P.d = { on: true, stopAt, log: [], recall: [], lv: [], ch: [], err: [], guarded: [], tips: [] }
  const wait = ms => new Promise(r => oST(r, ms))
  const vis = el => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'
  const btnIn = (root, labels) => [...root.querySelectorAll('button')].find(b => vis(b) && labels.includes(b.textContent.trim()))
  const key = k => (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, code: k, bubbles: true }))
  const md = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
  const ready = () => S.mode.kind === 'idle' || S.mode.kind === 'selected'
  const blocking = () => DL.dialogueOpen() || [...document.querySelectorAll('.owin.levelup, .owin.result, .owin.tip')].some(vis)
  const seen = new Set()
  let lastResult = null

  // 대원을 고르면 통제 영역 안내 (tips.ts) 가 바로 뜰 수 있다: 대사는 Esc, 카드는 남기고 닫은 뒤 고른 상태로 돌아올 때까지
  function closeTip() {
    const tip = document.querySelector('.owin.tip')
    if (!vis(tip)) return false
    D.tips.push({ n: S.def?.n, turn: S.turn, title: tip.innerText.split('\n')[0], line: DL.talkLog.at(-1)?.text?.slice(0, 40) })
    btnIn(tip, ['닫기'])?.click()
    return true
  }
  async function pick(u) {
    B.select(u); await wait(60)
    for (let i = 0; i < 100 && (DL.dialogueOpen() || vis(document.querySelector('.owin.tip')) || S.mode.kind === 'busy'); i++) {
      if (DL.dialogueOpen()) key('Escape'); else closeTip()
      await wait(80)
    }
  }
  async function settle(maxMs = 20000) {
    const t = Date.now()
    while (Date.now() - t < maxMs) { await wait(80); if (blocking()) return false; if (ready()) return true }
    return false
  }
  /** 적까지 길 거리 (유닛 무시, 그 유닛 이동 방식의 지형 비용). 호위 NPC 둘레 3칸 안에 적이 있으면 그 적들부터 */
  function field(kind) {
    const foes = S.units.filter(f => f.side === 'enemy' && f.hp > 0)
    const npcs = S.units.filter(o => o.side === 'ally' && o.troop !== 0 && o.hp > 0)
    const near = foes.filter(f => npcs.some(n => md(n, f) <= 3))
    const d = new Map(), q = []
    for (const f of near.length ? near : foes) { d.set(f.y * 1000 + f.x, 0); q.push([0, f.x, f.y]) }
    while (q.length) {
      q.sort((a, b) => a[0] - b[0])
      const [c, x, y] = q.shift()
      if (c > d.get(y * 1000 + x)) continue
      for (const [dx, dy] of G.DIRS) {
        const nx = x + dx, ny = y + dy
        if (!G.inside(S.map, nx, ny)) continue
        const nc = c + G.moveCost(S.map, nx, ny, kind)
        if (!isFinite(nc) || nc >= (d.get(ny * 1000 + nx) ?? Infinity)) continue
        d.set(ny * 1000 + nx, nc); q.push([nc, nx, ny])
      }
    }
    return d
  }
  function advanceSpot(u, lead) {
    const F = field(u.type.moveKind)
    let best = null, bs = Infinity
    for (const k of G.reachable(S.map, S.units, u).keys()) {
      const f = F.get(k) ?? 999, s = lead ? Math.abs(f - 7) : f
      if (s < bs) { bs = s; best = { x: k % 1000, y: Math.floor(k / 1000) } }
    }
    return best
  }
  async function moveWait(u, dest) {
    if (S.mode.kind === 'selected') { B.cancel(); await wait(40) }
    await pick(u)
    await B.clickTile(dest); await wait(300)
    const m = [...document.querySelectorAll('.owin')].find(w => vis(w) && btnIn(w, ['대기']))
    if (m) { btnIn(m, ['대기']).click(); return settle() }
    if (!ready()) { B.cancel(); await wait(60) }
    return true
  }
  async function partyTurn() {
    if (S.mode.kind === 'selected') { B.cancel(); await wait(60) }
    const tried = new Set()
    for (let i = 0; i < 20; i++) {
      const u = S.units.filter(o => o.troop === 0 && o.hp > 0 && !o.acted && !tried.has(o)).sort((a, b) => (a.member === 0) - (b.member === 0))[0]
      if (!u) break
      tried.add(u)
      const plan = planFor(u), lead = u.member === 0
      if (plan.target && !plan.magic && !(lead && u.hp < u.maxHp * 0.45)) {
        if (S.mode.kind === 'selected') { B.cancel(); await wait(40) }
        await pick(u)
        await B.clickTile({ x: plan.target.x, y: plan.target.y })
        if (!(await settle())) return
        if (!u.acted) { const d = advanceSpot(u, lead); if (d && (d.x !== u.x || d.y !== u.y) && !(await moveWait(u, d))) return }
        continue
      }
      if (u.hp < u.maxHp * (lead ? 0.6 : 0.35)) continue
      const d = advanceSpot(u, lead)
      if (d && (d.x !== u.x || d.y !== u.y) && !(await moveWait(u, d))) return
    }
    if (!ready()) return
    if (S.mode.kind === 'selected') { B.cancel(); await wait(40) }
    ;[...document.querySelectorAll('button')].find(b => vis(b) && b.textContent.replace(/\s/g, '') === '턴종료')?.click()
    await wait(200)
    const c = [...document.querySelectorAll('.owin')].find(w => vis(w) && btnIn(w, ['결정']))
    if (c) btnIn(c, ['결정']).click()
    await wait(400)
  }
  function guardUnits(n) {
    const who = guard[n] ?? (n >= guardLeadFrom ? '선두' : undefined)
    if (!who) return
    const u = who === '선두' ? S.units.find(o => o.troop === 0 && o.member === 0) : S.units.find(o => o.type.name === who)
    if (u && u.hp > 0 && u.maxHp < 300) { u.maxHp = 300; u.hp = 300; D.guarded.push(`${n}장 ${u.type.name}`) }
  }

  ;(async () => {
    while (D.on) {
      try {
        await wait(100)
        const n = S.def?.n
        if (n && D.ch.at(-1)?.n !== n) D.ch.push({ n, at: new Date().toLocaleTimeString() })
        if (n >= D.stopAt) { D.on = false; D.log.push(`${n}장에서 멈춤`); break }
        if (n) guardUnits(n)
        for (const l of DL.talkLog) if (l.name?.includes('회상') && !seen.has(l.text)) { seen.add(l.text); D.recall.push({ n, turn: S.turn, text: l.text }) }
        if (DL.dialogueOpen()) { key('Escape'); continue }
        const lv = document.querySelector('.owin.levelup')
        if (vis(lv)) { D.lv.push({ n, text: lv.innerText.replace(/\n+/g, ' | ') }); (btnIn(lv, ['승급']) || btnIn(lv, ['확인']))?.click(); continue }
        if (closeTip()) { await wait(100); continue }   // 시스템 안내 카드 (tips.ts): 제목과 바로 앞 대사를 남기고 닫기
        const res = document.querySelector('.owin.result')
        if (vis(res)) {
          if (res !== lastResult) { lastResult = res; D.log.push(`${n}장 ${res.innerText.replace(/\n+/g, ' / ').slice(0, 100)}`) }
          ;(btnIn(res, ['다음 장']) || btnIn(res, ['다시 하기']) || btnIn(res, ['확인']) || [...res.querySelectorAll('button')].find(vis))?.click()
          await wait(500); continue
        }
        const win = [...document.querySelectorAll('.owin')].find(w => vis(w) && ['cond', 'route', 'confirm'].some(c => w.classList.contains(c)))
        if (win) { (btnIn(win, ['확인', '결정']) || [...win.querySelectorAll('button')].find(vis))?.click(); await wait(200); continue }
        const go = document.querySelector('#mcamp .mc-go')
        if (vis(go)) { go.click(); await wait(300); [...document.querySelectorAll('.mc-modal button')].find(b => b.textContent.trim() === '출전')?.click(); await wait(500); continue }
        if (vis(document.querySelector('#camp'))) { const ok = document.querySelector('#camp .dlg .ok'); if (vis(ok)) ok.click(); else key('Enter'); await wait(500); continue }
        if (ready() && S.units?.some(u => u.troop === 0 && u.hp > 0 && !u.acted)) { await partyTurn(); continue }
      } catch (e) { D.err.push(String(e).slice(0, 200)); await wait(500) }
    }
  })()
  return 'started'
}

P.stop = function () { if (P.d) P.d.on = false; if (P.oST) window.setTimeout = P.oST }

P.status = function () {
  const D = P.d
  if (!D) return null
  const wins = D.log.filter(l => l.includes('승 리')).map(l => `${l.split('장')[0]}장 ${(l.match(/(\d+)턴/) ?? [])[1]}턴`)
  const losses = {}
  for (const l of D.log.filter(l => l.includes('패 배'))) { const k = `${l.split('장')[0]}장 ${l.split(' / ')[1]}`; losses[k] = (losses[k] ?? 0) + 1 }
  return { on: D.on, ch: D.ch.map(c => `${c.n}@${c.at}`), wins, losses, recall: D.recall, promos: D.lv.filter(l => l.text.includes('승급')).map(l => `${l.n}장 ${l.text.slice(0, 80)}`), levelUps: D.lv.length, guarded: [...new Set(D.guarded)], tips: D.tips.map(t => `${t.n}장 ${t.turn}턴 ${t.title}`), err: D.err }
}

P.restore = function () {
  P.stop()
  const bk = JSON.parse(localStorage.getItem(BACKUP) ?? 'null')
  if (!bk) return 'no backup'
  const now = []
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('eclipse.')) now.push(k) }
  for (const k of now) if (!(k in bk)) localStorage.removeItem(k)
  for (const [k, v] of Object.entries(bk)) localStorage.setItem(k, v)
  localStorage.removeItem(BACKUP)
  location.href = '/'
  return 'restored'
}
