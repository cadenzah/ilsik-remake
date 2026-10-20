// 브라우저 자동 진행 검증 (43장 통과). 개발 서버 페이지에서:
//   await import('/tools/verify_browser.js'); const plan = await (await fetch('/build/verify_plan.json')).json()
//   await __verify('remake' | 'original', plan.slice(0, 12), { tank: true })   — plan = python tools/verify.py --plan
// 장마다 iframe 으로 ?ed&stage&route&party&items&nocamp 를 열고 대화는 Esc 로 넘김 → 첫 아군 차례 → 적 HP 0 (도달 승리 장은 선두를 그 칸으로) → checkEnd → 결과·엔딩 창.
// 원작판은 적이 먼저 움직이는 장이 있어 느리다: 브라우저 창을 보이게 두고 몇 개씩. tank = 선두 HP 999 (성장 없는 기본 일행이 첫 차례 전에 지는 것 막기)
window.__verify = async function (ed, list, opt = {}) {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const out = []
  for (const e of list) {
    const r = { n: e.n, route: e.route, ed, errors: [], steps: [] }
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px;z-index:99999;border:0;background:#000'
    const q = `ed=${ed}&stage=${e.n}&route=${e.route}&party=${e.party.join(',')}&items=${e.items.join(',')}&nocamp`
    f.src = `/?${q}`
    document.body.append(f)
    await new Promise(ok => f.onload = ok)
    const w = f.contentWindow
    w.addEventListener('error', ev => r.errors.push('error: ' + ev.message))
    w.addEventListener('unhandledrejection', ev => r.errors.push('reject: ' + (ev.reason?.stack || ev.reason)))
    const ce = w.console.error.bind(w.console)
    w.console.error = (...a) => { r.errors.push('console: ' + a.join(' ').slice(0, 200)); ce(...a) }
    const doc = () => w.document
    let pumping = true, escs = 0
    ;(async () => {
      while (pumping) {
        const d = doc()
        const busyUi = d.querySelector('.speak, .gogo, #movie') || d.querySelector('.owin:not(.basic):not(.minimap):not(.result):not(.passive)')   // #movie = 엔딩 영상 (키 = 건너뛰기)
        const choice = [...d.querySelectorAll('.owin.result')].find(x => /^\s*선택/.test(x.textContent))
        if (choice) { choice.querySelector('button')?.click(); r.steps.push('choice') }
        else if (busyUi) { w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); escs++ }
        await sleep(60)
      }
    })()
    const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true } catch {} await sleep(100) } return false }
    const G = () => w.__game
    // opt.tank: 성장치 없는 검증 일행의 선두가 첫 아군 차례 전에 쓰러져 다시 하기를 반복하지 않게 (흐름 검증용)
    if (opt.tank) (async () => { let tries = 0; while (pumping && tries++ < 600) { const L = G()?.S?.units?.find(u => u.troop === 0 && u.member === 0); if (L && L.maxHp < 999) { L.maxHp = L.hp = 999; r.steps.push('tank') } await sleep(100) } })()
    // 1) 첫 아군 차례까지
    const ready = await until(() => G()?.S?.map && G().S.mode.kind !== 'busy' && !doc().querySelector('.speak'), opt.readyMs ?? 60000)
    r.steps.push(ready ? 'ready' : 'NOT READY mode=' + G()?.S?.mode?.kind)
    if (ready) {
      const S = G().S
      r.start = { units: S.units.length, reserve: S.reserve.length, troop: [...S.troopState], turn: S.turn,
        party: S.units.filter(u => u.troop === 0).map(u => `${u.type.name}:${u.hp}/${u.maxHp}`) }
      // 2) 승리 만들기: 도달 승리면 선두를 그 칸으로, 아니면 적 모두 HP 0
      const reach = S.cond.find(c => 'reach' in c.if && c.do.some(d => d === 'win' || d === 'ending'))
      if (reach) { const lead = S.units.find(u => u.troop === 0 && u.member === 0); lead.x = lead.px = reach.if.reach[0]; lead.y = lead.py = reach.if.reach[1]; r.steps.push('reach') }
      else { for (const u of [...S.units, ...S.reserve]) if (u.side === 'enemy') { u.hp = 0; u.alpha = 0 } r.steps.push('kill') }
      S.mode = { kind: 'busy' }
      const end = G().checkEnd()
      const done = await until(() => [...doc().querySelectorAll('.owin.result')].some(x => !/^\s*선택/.test(x.textContent)) || doc().querySelector('#titlescreen:not([hidden])'), opt.endMs ?? 60000)
      const res = [...doc().querySelectorAll('.owin.result')].find(x => !/^\s*선택/.test(x.textContent))
      r.steps.push(done ? 'result: ' + (res ? res.textContent.replace(/\s+/g, ' ').slice(0, 80) : 'title') : 'NO RESULT')
      r.ended = await Promise.race([end, sleep(10)])
      r.party = G().camp().party.length
    }
    pumping = false
    r.escs = escs
    if (!opt.keep) f.remove()
    out.push(r)
  }
  return out
}
