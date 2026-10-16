// 컷신 재생 검증 (cutscene.ts). 개발 서버 페이지에서:
//   await import('/tools/verify_cuts.js'); __cutTest([[판, 장, 루트, 일행, 소지품], …]).then(r => window.__res = r)
// 장마다 iframe 으로 ?…&nocamp 를 열고 대화는 Esc 로 넘기며 (컷신은 건너뛰지 않음) 적 HP 0 → 결과까지. 기록: 컷신이 뜬 때·자리·크기,
// 컷신이 떠 있는 동안 시작한 대화 (talkAt), 사라진 때 (gone, 전투 중 덧그림), 오류. 일행·소지품은 build/verify_plan.json (tools/verify.py --plan) 에서
window.__cutTest = async function (cases) {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const out = []
  for (const [ed, n, route, party, items] of cases) {
    const r = { ed, n, route, errors: [], cuts: [], talks: 0 }
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px;z-index:99999;border:0;background:#000'
    f.src = `/?ed=${ed}&stage=${n}&route=${route}&party=${party.join(',')}&items=${items.join(',')}&nocamp`
    document.body.append(f)
    await new Promise(ok => f.onload = ok)
    const w = f.contentWindow, t0 = performance.now(), T = () => Math.round(performance.now() - t0)
    w.addEventListener('error', ev => r.errors.push('error: ' + ev.message))
    w.addEventListener('unhandledrejection', ev => r.errors.push('reject: ' + (ev.reason?.stack || ev.reason)))
    const D = await w.eval("import('/src/core/dialogue.ts')")
    let pumping = true, cur = null, wasOpen = false
    const box = c => { const cv = c.querySelector('canvas'); return cv ? `${cv.width}x${cv.height}@${cv.style.left},${cv.style.top}` : 'none' }
    ;(async () => {
      while (pumping) {
        const d = w.document, c = d.querySelector('.cutscene')
        if (c && c !== cur) { cur = c; r.cuts.push({ at: T(), root: c.style.cssText.slice(0, 60), canvas: box(c) }) }
        if (cur && !c) { r.cuts.at(-1).gone = T(); cur = null }
        if (cur && r.cuts.at(-1).canvas === 'none') r.cuts.at(-1).canvas = box(cur)
        const open = D.dialogueOpen()
        if (open && !wasOpen) { r.talks++; if (cur) (r.cuts.at(-1).talkAt ??= []).push(T()) }
        wasOpen = open
        if (open || d.querySelector('.gogo, .owin:not(.basic):not(.minimap):not(.result):not(.passive)')) w.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        const choice = [...d.querySelectorAll('.owin.result')].find(x => /^\s*선택/.test(x.textContent))
        if (choice) choice.querySelector('button')?.click()
        await sleep(50)
      }
    })()
    const until = async (fn, ms) => { const s = Date.now(); while (Date.now() - s < ms) { try { if (fn()) return true } catch {} await sleep(100) } return false }
    const G = () => w.__game
    ;(async () => { let k = 0; while (pumping && k++ < 900) { const L = G()?.S?.units?.find(u => u.troop === 0 && u.member === 0); if (L && L.maxHp < 999) L.maxHp = L.hp = 999; await sleep(100) } })()
    const ready = await until(() => G()?.S?.map && G().S.mode.kind !== 'busy' && !D.dialogueOpen(), 90000)
    r.ready = ready ? T() : 'NO'
    if (ready) {
      const S = G().S
      const reach = S.cond.find(c => 'reach' in c.if && c.do.some(d => d === 'win' || d === 'ending'))
      if (reach) { const lead = S.units.find(u => u.troop === 0 && u.member === 0); lead.x = lead.px = reach.if.reach[0]; lead.y = lead.py = reach.if.reach[1] }
      else for (const u of [...S.units, ...S.reserve]) if (u.side === 'enemy') { u.hp = 0; u.alpha = 0 }
      S.mode = { kind: 'busy' }
      G().checkEnd()
      const done = await until(() => [...w.document.querySelectorAll('.owin.result')].some(x => !/^\s*선택/.test(x.textContent)) || w.document.querySelector('#titlescreen:not([hidden]), #camp, #mcamp, #worldmap'), 90000)
      r.end = done ? T() : 'NO END'
    }
    pumping = false
    f.remove()
    out.push(r)
  }
  return out
}
