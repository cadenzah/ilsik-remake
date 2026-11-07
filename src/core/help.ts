// 개선판 규칙 도움말 (B1 제안 N5 → 2026-11-07 개편, .claude/docs/help-proposal.md). 전투 메뉴 「도움말」과 도감 「도움말」 탭이 같은 글을 쓴다.
// 주제마다 요약 한 줄 → 핵심 (그림·표 포함) → 「자세히」 (접힘). 문구는 짧게, 화면에 안 보이는 내부 계수·배율은 쓰지 않는다. 용어는 화면과 같게 (반격·협공·통제 영역·생명상해 마법).
// 안내 카드 (tips-proposal.md, core/tips.ts) 는 아래 TIP_CARDS 가 주제 키·요약·where·문장 상수 L 로 이 글에서 가져간다. 문장을 고치면 카드도 바뀐다.
// 패배 = 출전 0번 (battleCore judge member([0,0])) + 장별 dead→lose. 본편은 늘 아리크스 (scenes.json post 의 0번 자리 = 아리크스 0·1 뿐), 숨은 장 44·45 는 레스다 (content/remake/battles). 목표 창 실패조건 = info.ts conditions
// 수치의 근거 = editions/original/rules.ts (피로 계수·휴식·행동 뒤 피로·aiRests·actsTwice·flankBonus), core/attack.ts (사격·범위: 맨해튼 거리 1 = 상하좌우), core/battleCore.ts counterDamage (반격), core/grid.ts reachable (통제 영역), editions/remake/growth.ts (성장·쓰러진 대가)
// 전력 공격·방어 태세 = remake/index.ts stance (제안 27), 협공 = remake/index.ts flank (제안 30), 상성 = remake/affinity.ts (제안 25·25-2). 규칙을 바꾸면 여기도 고친다. 피로 % = 공격 계수 (2.6 − F) · 방어 계수 (2.4 − F) 의 피로 0 대비 감소 (30: 18·20, 50: 34·37, 70: 54·59)
import type { UnitType } from './data'
import { mapRect } from './screen'
import { closeWin, openWin } from './ui'

/** 지금까지 만난 것 — 아직 안 만난 종족·인물 이름이 도움말로 먼저 드러나지 않게 (스포일러) */
export interface HelpKnown { races: Set<string>; names: Set<string> }
/** 만난 유닛 번호들 → 만난 종족·이름 */
export function helpKnown(ids: Iterable<number>, types: UnitType[], races: string[]): HelpKnown {
  const us = [...new Set(ids)].map(i => types[i]).filter(Boolean)
  return { races: new Set(us.map(u => races[u.race] ?? '')), names: new Set(us.map(u => u.name)) }
}
type Gate = (k: HelpKnown) => boolean
const race = (r: string): Gate => k => k.races.has(r)
const met = (...ns: string[]): Gate => k => ns.some(n => k.names.has(n))

/** 칸 그림: 글자 한 개 = 한 칸. M 나 · A 같은 편 · F 적 · a 맞는 같은 편 · f 맞는 적 · h 맞는 빈칸 · r 갈 수 있는 칸 · s 들어가면 멈추는 칸 · x 못 가는 칸 · . 빈칸 */
type Fig = { rows: string[]; cap: string; tag?: Record<string, string> }
type Item = string | { fig: Fig } | { html: (k: HelpKnown) => string } | { t: string; if: Gate }
export interface HelpTopic { key: string; title: string; both?: boolean; summary?: string; core: Item[]; more?: Item[]; where?: string }

const AFF_ROWS: [who: string, weak: string, resist: string, gate?: Gate][] = [
  ['날 수 있는 유닛', '활 · 바람', '땅'],
  ['마법을 쓰는 유닛', '반대 계열', '자기 계열'],
  ['중갑 기사', '땅', ''],
  ['불사족', '빛 (크게) · 불', '어둠', race('불사족')],
  ['마족', '빛', '어둠 · 불', race('마족')],
  ['용족', '물', '불', race('용족')],
  ['해족', '바람', '물', race('해족')],
  ['빙마녀', '불', '물', race('빙마녀')],
  ['기계', '바람', '', race('기계')],
]

// 도움말 본문과 안내 카드 (TIP_CARDS) 가 함께 쓰는 문장. 한 곳에서 고치면 두 곳이 같이 바뀐다
const L = {
  wake: '[[경계]] 중인 적은 가까이 다가가거나 공격하면 깨어납니다. 위험 범위를 켜면 청록색으로 표시됩니다.',
  zocClear: '길을 막은 적을 먼저 치워야 지나갈 수 있습니다.',
  zocSlip: '날 수 있는 유닛과 도둑은 멈추지 않습니다.',
  power: '[[전력 공격]]: 피해가 크게 늘지만, 피로도 그만큼 훨씬 많이 쌓입니다.',
  guard: '[[방어]]: 움직이지 않은 차례에만 고를 수 있습니다. 다음 차례까지 물리 방어가 오릅니다.',
  guardRest: '방어한 차례는 쉰 것으로 치지 않아서 생명이 차지 않습니다. 피로도 쉴 때보다 덜 풀립니다.',
  tired70: '피로가 70을 넘으면 반격할 수 없습니다.',
  foeRest: '적도 피로가 70을 넘거나 생명이 ¼ 이하로 떨어지면 그 차례는 쉬어 갑니다.',
  oppose: '서로 반대인 계열은 물과 불, 바람과 땅, 빛과 어둠입니다. 마법을 쓰는 유닛은 주로 쓰는 계열에 강하고 그 반대 계열에 약합니다.',
  down: '이긴 장이라도 쓰러진 대원은 그 장에서 얻은 경험치를 잃고, 다음 장을 지친 상태로 시작합니다. 그 장에서 오른 레벨도 되돌아갑니다.',
  promo: '레벨이 올라 무기·방어구를 [[승급]]할 수 있게 되면 바로 받아도 되고 나중에 정비 화면에서 받아도 됩니다. 승급하면 떨어지는 능력치도 있으니 비교해 보고 고르세요.',
  bench: '출전하지 않은 동료도 이긴 장에서 경험치를 조금 받습니다.',
  late: '늦게 합류한 동료는 일행과 비슷한 레벨로 들어옵니다.',
  ancient: '용자의검 · 빛의갑옷 · 무자의책 · 현자의돌은 고대 병기입니다. 지닌 개수만큼 제관과 사바카의 방어를 뚫습니다. 마법에는 효과가 없습니다.',
}

// ---------- 원작과 달라진 점 (2026-11-07 사용자: 신규·개선 표시, 「이건 꼭 알아두세요」, 숨은 장·진엔딩은 넣지 않음) ----------
// MUST_KNOW = 원작 감각대로 하면 손해 보는 네 가지 (레벨업 고정은 뺌 — 다시 불러와 굴리는 사람만 겪고, 아래 항목·강해지기에 있다). 도움말 「원작과 차이」 맨 위에만 (처음 새로 시작 때 보여 주던 쪽은 뺐다 — 사용자: 과하게 친절, 겪으며 아는 재미). 한 줄 한 문장으로 짧게
const MUST_KNOW_TITLE = '이건 꼭 알아두세요'
const MUST_KNOW = [
  '적은 [[우리 편이 다 움직인 뒤]]에 움직입니다.',
  '근접 공격을 받고 살아남으면 [[반격]]합니다.',
  '[[피해 계산]]이 원작과 다릅니다.',
  '[[쓰러진 대원]]은 이겨도 그 장에서 얻은 경험치를 다 잃고, 다음 장을 지친 채 시작합니다.',
]
/** 표의 링크: 누르면 그 주제로 (mountHelp) */
const go = (key: string, label: string) => `<a data-topic="${key}" href="#">${label}</a>`
const NEW = '<em class="tag new">신규</em>', MOD = '<em class="tag mod">개선</em>'
// [무엇, 원작, 개선판]. 근거: 순서 = remake/index.ts order, 피해·마법 = balance-proposal 1·2, 경계 = original/ai.ts aiGate, 물러나 쉼·보스·호위 NPC = remake/ai.ts (제안 10·N3), 승급 = 36, 성장 = N4·5, 쓰러짐 = 12, 별 = 11·34
const DIFF_ROWS: [string, string, string][] = [
  ['전투 순서', '민첩 순서대로 한 명씩', `${MOD} 우리 편 → 함께 싸우는 이 → 적, 편마다 한꺼번에`],
  ['피해', '방어가 앞서면 1', `${MOD} 계산식과 장마다 적의 세기를 다시 맞춤`],
  ['마법', '원작 수치', `${MOD} 생명상해·생명회복의 세기를 다시 맞춤`],
  ['반격', '없음', `${NEW} ${go('counter', '반격')}`],
  ['새 규칙', '없음', `${NEW} ${go('flank', '협공')} · ${go('zoc', '통제 영역')} · ${go('stance', '전력·방어')} · ${go('affinity', '약점·내성')}`],
  ['경계 중인 적', '다가가거나 치면 깸', `${MOD} 깨우는 범위를 위험 범위에서 봄 (${go('foes', '적의 속셈')})`],
  ['지친 적', '그 자리에서 쉼', `${MOD} 손이 닿지 않는 곳으로 물러나 쉼`],
  ['적의 움직임', '저마다 달려듦', `${MOD} 보스는 자리를 지키고, 무리는 발을 맞춰 다가옴`],
  ['지켜야 할 인물', '적에게 달려듦', `${MOD} 물러서며 싸움`],
  ['승급', '레벨업 때 바로', `${MOD} 바로 받거나 정비 화면에서 나중에 (${go('grow', '강해지기')})`],
  ['레벨업', '오를 때마다 무작위', `${MOD} 판마다 정해짐, 오래 덜 오른 능력치는 더 오름`],
  ['쓰러진 대원', '대가 없음', `${NEW} 그 장의 경험치를 잃고 지친 채 다음 장으로`],
  ['출전 안 한 동료', '경험치 없음', `${NEW} 조금 받음, 늦게 합류한 동료는 일행 레벨 가까이`],
  ['난이도', '하나', `${NEW} 쉬움 · 보통 · 어려움 (설정에서 언제든)`],
  ['도전 과제', '없음', `${NEW} 장마다 별 (${go('win', '이기고 지기')})`],
  ['다시 하기', '이어하기만', `${NEW} 장 지도에서 깬 장 다시 하기 · 도감`],
  ['이야기', '원작 대사', `${MOD} 현대어로 새로 쓴 대사, 덧붙인 장면`],
  ['화면', '원작 창', `${NEW} 위험 범위 · 피해 예측 · 적을 눌러 이동과 공격 · 적 차례 요약`],
]

export const HELP: HelpTopic[] = [
  { key: 'start', title: '처음이라면', core: [
    '장마다 정해진 [[고정 대원]]은 늘 출전하고, 쓰러지면 패배합니다. 정비 화면에 「고정」으로 표시됩니다.',
    '공격은 빗나가지 않습니다. 확인창에 나온 피해가 그대로 들어갑니다.',
    '근접 공격을 받고 살아남은 상대는 바로 [[반격]]해 옵니다. 한 번에 쓰러뜨리지 못할 상대라면 붙기 전에 한 번 더 생각해 보세요.',
    '싸우고 움직일수록 피로가 쌓여 약해집니다. 한 차례 가만히 있으면 쉬면서 회복합니다.',
    '[[위험 범위]]를 켜 두면 적이 닿을 수 있는 칸이 표시됩니다.',
  ] },
  { key: 'diff', title: '원작과 차이', summary: '원작을 해 본 분을 위해 개선판에서 바뀐 것을 모았습니다.', core: [
    { html: () => `<div class="must"><b>${MUST_KNOW_TITLE}</b><ol>${MUST_KNOW.map(l => `<li>${term(l)}</li>`).join('')}</ol></div>` },
    // 좁은 전투 창에서도 읽히게 표가 아니라 항목마다 세 줄 (이름 + 표시 / 원작 / 개선판)
    { html: () => `<ul class="diff">${DIFF_ROWS.map(([w, o, r]) => {
      const [, tag, rest] = r.match(/^(<em[^>]*>[^<]*<\/em>)\s*(.*)$/) ?? ['', '', r]
      return `<li><span class="w">${w}</span>${tag}<br><span class="o">원작</span>${o}<br><span class="o">개선판</span>${rest}</li>`
    }).join('')}</ul>` },
  ], more: [
    `안내 카드 제목 옆의 ${NEW}는 원작에 없던 규칙, ${MOD}은 원작에서 바뀐 규칙입니다. 표시가 없으면 원작과 같은 규칙입니다.`,
    '원작 그대로 하고 싶다면 타이틀 메뉴 맨 아래에서 원작판을 고르세요.',
  ] },
  { key: 'win', title: '이기고 지기', summary: '[[고정 대원]]이 쓰러지면 패배합니다. 장에 따라 함께 지켜야 할 인물이 더 있습니다.', core: [
    '장마다 [[도전 과제]]가 붙어 있습니다. 해낸 만큼 별을 받고, 가장 좋은 기록은 장 지도에 남습니다.',
    '적은 쓰러뜨릴 수 있는 상대부터 노립니다. 고정 대원이 많이 다쳤다면 뒤로 빼 주세요.',
  ], more: [
    '고정 대원은 출전에서 뺄 수 없습니다. 누구인지는 정비 화면의 「고정」 표시와 실패조건에서 확인할 수 있습니다.',
    '난이도에 따라 적이 주는 피해가 달라지고, 어려움에서는 적도 협공을 합니다. 난이도는 설정에서 언제든 바꿀 수 있습니다.',
  ], where: '누가 쓰러지면 지는지는 전투 메뉴 「목표」의 실패조건에, 도전 과제도 같은 곳에 나옵니다.' },
  { key: 'counter', title: '반격', both: true, summary: '근접 공격을 받고 살아남으면 곧바로 [[반격]]합니다. 몇 번을 반격해도 위력은 줄지 않습니다.', core: [
    { html: () => `<table><tr><th>반격하지 못할 때</th><th>반격이 없는 공격</th></tr>
      <tr><td>피로가 70을 넘었을 때<br>생명이 ¼ 이하일 때<br>혼수 · 대기 중일 때</td><td>기사 · 포수 · 궁수 · 추전수의 공격<br>마법</td></tr></table>` },
    '반격 피해는 직접 공격할 때와 같습니다.',
  ], where: '공격 확인창에 「반격 −N」으로 미리 나옵니다.' },
  { key: 'flank', title: '협공', summary: '공격할 상대 바로 옆에 우리 편이 붙어 있으면 한 명당 물리 피해가 늘어납니다. 세 명까지 셉니다.', core: [
    { fig: { rows: ['.A.', 'AFM', '...'], cap: '옆에 우리 편이 둘이면 두 명분이 붙습니다.', tag: { A: '+' } } },
    '공격하는 본인은 세지 않습니다. 혼수 상태인 동료도 빠집니다.',
  ], more: [
    '적은 어려움 난이도에서만 협공합니다.',
  ], where: '공격 확인창에 「협공 +N%」로 나옵니다.' },
  { key: 'stance', title: '전력·방어', summary: '행동 메뉴에서 보통 공격 대신 고를 수 있습니다.', core: [
    L.power,
    L.guard,
  ], more: [
    L.guardRest,
  ], where: '쌓일 피로는 공격 확인창에 나옵니다.' },
  { key: 'zoc', title: '움직이기', both: true, summary: '적 바로 옆 칸에 들어서면 그 자리에서 이동이 끝납니다. 이것을 [[통제 영역]]이라고 합니다.', core: [
    { fig: { rows: ['.rrsx', 'MrsFx', '.rrsx'], cap: '노란 테두리 칸에 들어서면 멈춥니다. 적 뒤쪽으로는 돌아갈 수 없습니다.' } },
    L.zocClear,
  ], more: [
    L.zocSlip,
    '혼수 상태인 유닛 옆은 그냥 지나갈 수 있습니다.',
  ] },
  { key: 'tired', title: '지치고 쉬기', both: true, summary: '피로가 쌓일수록 공격과 방어가 함께 떨어집니다. 움직이지도 공격하지도 않고 차례를 넘기면 쉬면서 생명과 피로가 회복됩니다.', core: [
    { html: () => `<table><tr><th>피로가 쌓이는 행동</th><th>쌓이는 양</th></tr>
      <tr><td>공격 · 반격</td><td>4~8</td></tr><tr><td>이동</td><td>한 칸마다 1</td></tr>
      <tr><td>마법</td><td>마법 목록에 적힌 만큼</td></tr><tr><td>공격받기</td><td>쌓이지 않음</td></tr></table>` },
    L.tired70,
    L.foeRest,
  ], more: [
    '[[부하상태]]가 낮을수록 공격하거나 마법을 쓸 때 피로가 더 많이 쌓입니다.',
    '레벨이 오르면 피로가 0으로 돌아갑니다. 생명회복 마법을 받아도 줄어듭니다.',
    '지금 피로에 마법의 피로를 더해 90이 넘으면 그 마법은 쓸 수 없습니다.',
  ] },
  { key: 'jobs', title: '직업별 공격', summary: '궁수·추전수·포수는 가로세로 일직선으로만 쏠 수 있고, 기사와 포수는 한 번에 여러 명을 공격합니다.', core: [
    { fig: { rows: ['..h..', '..h..', 'hhMhh', '..h..', '..h..'], cap: '궁수 · 추전수 · 포수: 가로세로 일직선으로만 쏩니다.' } },
    { fig: { rows: ['...a.', 'M.hFf', '...h.'], cap: '포수: 맞은 칸과 그 상하좌우가 함께 맞습니다. 우리 편도 휘말립니다.' } },
    { fig: { rows: ['.f..', 'fA.M', '.f..'], cap: '기사: 우리 편 한 명 (자기 자신도 됩니다) 을 골라 그 상하좌우의 적을 칩니다.', tag: { A: '편' } } },
  ], more: [
    '[[생명상해 마법]]은 상대의 정신이 높을수록 덜 들어갑니다. 방어는 높은데 정신이 낮은 적에게 쓰면 좋습니다.',
    { t: L.ancient, if: met('제관', '사바카') },
    { t: '혜유가 질풍화를 신고 민첩이 61 이상이면 한 차례에 두 번 움직입니다.', if: met('혜유') },
  ] },
  { key: 'affinity', title: '약점·내성', both: true, summary: '생명상해 마법과 활은 상대에 따라 더 잘 듣기도, 덜 듣기도 합니다. 이것을 [[상성]]이라고 합니다.', core: [
    { html: k => `<table><tr><th>상대</th><th>약점</th><th>내성</th></tr>${AFF_ROWS.filter(r => !r[3] || r[3](k))
      .map(([w, a, b]) => `<tr><td>${w}</td><td>${a}</td><td>${b || '—'}</td></tr>`).join('')}</table>` },
    L.oppose,
    '두 가지 이상에 해당하면 효과가 겹칩니다.',
  ], more: [
    '칼이나 창 같은 다른 물리 공격, 그리고 그 밖의 마법에는 상성이 없습니다. 포수의 포격도 마찬가지입니다.',
    '새로운 종족을 만나면 이 표에 추가됩니다.',
  ], where: '공격 확인창에 「약점」「내성」으로 표시되고, 유닛에 마우스를 올리면 이유가 나옵니다.' },
  { key: 'foes', title: '적의 속셈', summary: '적은 쓰러뜨릴 수 있는 상대와 회복 마법을 쓰는 대원을 먼저 노립니다.', core: [
    L.wake,
    '적 부대는 보조를 맞춰 다가오다가, 한 명이 싸움을 시작하면 다 같이 몰려듭니다.',
  ], more: [
    '[[대기]] 중인 적은 정해진 때가 될 때까지 공격받아도 움직이지 않습니다.',
    '보스는 제자리를 지키다가, 그 차례에 닿는 상대가 있을 때만 움직입니다.',
    '지친 적은 일행의 손이 닿지 않는 곳이 있으면 그쪽으로 물러나 쉽니다. NPC도 마찬가지입니다.',
  ] },
  { key: 'status', title: '중독·혼수', both: true, summary: '중독과 혼수는 둘 다 3차례 동안 이어집니다.', core: [
    '[[중독]]: 차례마다 생명이 ⅓씩 줄어듭니다.',
    '[[혼수]]: 아무 행동도 할 수 없습니다. 반격도 못 하고, 옆을 지나가는 적을 막지도 못하며, 협공에도 끼지 못합니다.',
  ] },
  { key: 'grow', title: '강해지기', summary: '경험치가 100이 되면 레벨이 오릅니다. 레벨이 높은 적일수록, 마지막 일격을 넣을수록 경험치를 많이 받습니다.', core: [
    L.down,
    L.promo,
  ], more: [
    L.bench,
    L.late,
    '전직하거나 출전 대원을 바꿔도 레벨은 그대로 이어집니다.',
    '레벨이 오를 때 어떤 능력치가 얼마나 오를지는 판마다 정해져 있어서, 다시 해도 결과가 같습니다. 오랫동안 덜 오른 능력치는 다음 레벨에서 하나 더 오릅니다.',
  ] },
]

// ---------- 안내 카드 (tips-proposal.md, core/tips.ts) ----------
// 카드 = 그 주제 (topic = HELP 의 key) 의 글에서 가져온다. '@sum' = 주제의 요약, '@where' = 주제의 「어디에서 보나」, 나머지는 위 L 의 문장 (도움말 본문과 같은 글).
// 「도움말에서 더 보기」 는 그 주제를 연다. 키 'resist:fly' 처럼 갈래가 있으면 갈래 것이 먼저
export interface TipCard { topic: string; title: string; lines: string[] }
const NO_COUNTER = '피로가 70을 넘었거나 생명이 ¼ 이하이면 반격하지 못합니다. 기사·포수·궁수·추전수의 공격과 마법에는 반격이 없습니다.'   // 반격 주제의 표와 같은 내용
const tc = (topic: string, title: string, ...lines: string[]): TipCard => ({ topic, title, lines })
/** 상성 갈래 한 줄 (remake/affinity.ts affinityKinds 의 갈래, 도움말 표 AFF_ROWS 와 같은 내용) */
export const AFF_LINE: Record<string, string> = {
  undead: '불사족은 빛에 크게 약하고 불에도 약합니다. 어둠에는 강합니다.',
  fly: '날 수 있는 유닛은 활과 바람에 약하고 땅에 강합니다.',
  caster: L.oppose,
  heavy: '중갑 기사는 땅의 마법에 약합니다.',
  archer: '날 수 있는 우리 편은 활에 약합니다. 적 궁수 곁에서는 조심하세요.',
  demon: '마족은 빛에 약하고 어둠과 불에 강합니다.',
  dragon: '용족은 물에 약하고 불에 강합니다.',
  sea: '해족은 바람에 약하고 물에 강합니다.',
  ice: '빙마녀는 불에 약하고 물에 강합니다.',
  machine: '기계는 바람에 약합니다.',
}
export const TIP_CARDS: Record<string, TipCard> = {
  wake: tc('foes', '경계', L.wake),
  counter: tc('counter', '반격', '@sum', NO_COUNTER, '@where'),
  zoc: tc('zoc', '통제 영역', '@sum', L.zocClear, L.zocSlip),
  flank: tc('flank', '협공', '@sum', '@where'),
  stance: tc('stance', '전력 공격·방어', L.power, L.guard, L.guardRest),
  tired: tc('tired', '피로', '@sum', L.tired70),
  foeRest: tc('tired', '적의 휴식', L.foeRest, '쉬어 가는 적은 그 차례에 공격하지 않습니다.'),
  escort: tc('win', '함께 지킬 인물', '@sum', '@where'),
  // 상성은 장 시작에 그 장에서 처음 보이는 갈래를 묶어 소개 (tips.ts affinityIntro, 카드 = 아래 갈래 문장들 + 그 장의 적별 약점·내성). 안내 기록에는 갈래마다
  'affinity:undead': tc('affinity', '상성 · 불사족', '@sum', AFF_LINE.undead, '@where'),
  'affinity:fly': tc('affinity', '상성 · 날 수 있는 적', '@sum', AFF_LINE.fly, '@where'),
  'affinity:caster': tc('affinity', '상성 · 마법 쓰는 적', '@sum', AFF_LINE.caster, '@where'),
  'affinity:heavy': tc('affinity', '상성 · 중갑', '@sum', AFF_LINE.heavy, '@where'),
  'affinity:archer': tc('affinity', '상성 · 활과 비행', '@sum', AFF_LINE.archer, '@where'),
  'affinity:demon': tc('affinity', '상성 · 마족', '@sum', AFF_LINE.demon, '@where'),
  'affinity:dragon': tc('affinity', '상성 · 용족', '@sum', AFF_LINE.dragon, '@where'),
  'affinity:sea': tc('affinity', '상성 · 해족', '@sum', AFF_LINE.sea, '@where'),
  'affinity:ice': tc('affinity', '상성 · 빙마녀', '@sum', AFF_LINE.ice, '@where'),
  'affinity:machine': tc('affinity', '상성 · 기계', '@sum', AFF_LINE.machine, '@where'),
  promo: tc('grow', '승급', L.promo),
  down: tc('grow', '쓰러진 대원', L.down),
  bench: tc('grow', '대기 동료', L.bench, L.late),
  ancient: tc('jobs', '고대 병기', L.ancient, '공격 확인창에 「특효」로 표시됩니다.'),
}
// 카드 제목 옆 표시 (원작과 차이): 신규 = 원작에 없던 규칙, 개선 = 원작에도 있던 것이 바뀜, 없음 = 원작과 같음 (foeRest·escort).
// wake = 원작도 경계 대기가 있었고 깨우는 범위가 보이게 됨, tired = 원작 피로에 「70 넘으면 반격 못 함」, promo = 원작은 레벨업 때 바로 승급
export type TipTag = '신규' | '개선'
const TIP_TAG: Record<string, TipTag> = {
  counter: '신규', zoc: '신규', flank: '신규', stance: '신규', affinity: '신규',
  down: '신규', bench: '신규', ancient: '신규', wake: '개선', tired: '개선', promo: '개선',
}
/** 카드 키 (갈래 포함, 'resist:fly') 의 표시 HTML. 없으면 빈 글자 */
export function tipTagHtml(key: string) {
  const t = TIP_TAG[key.split(':')[0]]
  return !t ? '' : t === '신규' ? `<em class="tag new" title="원작에 없던 규칙">신규</em>` : `<em class="tag mod" title="원작에서 바뀐 규칙">개선</em>`
}
/** 카드 글 (HTML, 문장마다 <br> — openWin 이 줄 수로 높이를 잰다). '@sum'·'@where' 를 주제 글로 */
export function tipCardHtml(c: TipCard) {
  const t = HELP.find(h => h.key === c.topic)
  return c.lines.map(l => l === '@sum' ? t?.summary : l === '@where' ? t?.where : l).filter(Boolean).map(l => term(l!)).join('<br>')
}
export const tipCard = (key: string, variant?: string) => (variant && TIP_CARDS[`${key}:${variant}`]) || TIP_CARDS[key]

const CELL = 18
const CELL_TEXT: Record<string, string> = { M: '나', A: '편', F: '적', a: '편', f: '적' }
function figSvg(f: Fig) {
  const w = Math.max(...f.rows.map(r => r.length)), h = f.rows.length
  const cells = f.rows.flatMap((r, y) => [...r].map((c, x) => {
    const at = `x="${x * CELL + 1}" y="${y * CELL + 1}" width="${CELL - 2}" height="${CELL - 2}"`
    const label = f.tag?.[c] ?? CELL_TEXT[c]
    return `<rect class="c-${c === '.' || c === ' ' ? 'e' : c}" ${at} rx="2"/>${label ? `<text x="${x * CELL + CELL / 2}" y="${y * CELL + CELL / 2 + 4}">${label}</text>` : ''}`
  })).join('')
  return `<div class="fig"><svg width="${w * CELL}" height="${h * CELL}" viewBox="0 0 ${w * CELL} ${h * CELL}" aria-hidden="true">${cells}</svg><span>${f.cap}</span></div>`
}

const term = (s: string) => s.replace(/\[\[(.+?)\]\]/g, '<b>$1</b>')
function item(i: Item, k: HelpKnown): string {
  if (typeof i === 'string') return `<li>${term(i)}</li>`
  if ('fig' in i) return `<li class="x">${figSvg(i.fig)}</li>`
  if ('html' in i) return `<li class="x">${i.html(k)}</li>`
  return i.if(k) ? `<li>${term(i.t)}</li>` : ''
}

export function topicHtml(t: HelpTopic, k: HelpKnown) {
  const more = (t.more ?? []).map(i => item(i, k)).join('')
  return `<h4>${t.title}${t.both ? '<em>적도 같음</em>' : ''}</h4>
    ${t.summary ? `<p class="sum">${term(t.summary)}</p>` : ''}
    <ul>${t.core.map(i => item(i, k)).join('')}</ul>
    ${more ? `<details><summary>자세히</summary><ul>${more}</ul></details>` : ''}
    ${t.where ? `<p class="where">${t.where}</p>` : ''}`
}

let lastTopic = HELP[0].key   // 다시 열면 마지막에 본 주제
/** 주제 목록 + 본문. el 안을 채우고 고르기를 잇는다. at = 주제 키, extra = 목록 맨 앞에 붙일 주제 (전투 메뉴의 「안내 기록」) */
export function mountHelp(el: HTMLElement, k: HelpKnown, at = lastTopic, extra: HelpTopic[] = []) {
  const list = [...extra, ...HELP]
  el.classList.add('help')
  el.innerHTML = `<div class="hl">${list.map((t, i) => `<button data-i="${i}">${t.title}</button>`).join('')}</div><div class="hb"></div>`
  const body = el.querySelector<HTMLElement>('.hb')!, btns = [...el.querySelectorAll<HTMLButtonElement>('.hl button')]
  const show = (i: number) => {
    lastTopic = list[i].key
    btns.forEach((b, j) => b.classList.toggle('on', i === j))
    body.innerHTML = topicHtml(list[i], k)
    body.scrollTop = 0
    // 「자세히」를 펴면 펼친 내용이 보이게 내려 준다 (아래가 잘려 있으면 열린 줄 모른다). 위 끝은 넘지 않는다
    body.querySelector('details')?.addEventListener('toggle', e => {
      const d = e.currentTarget as HTMLDetailsElement
      if (!d.open) return
      const br = body.getBoundingClientRect(), dr = d.getBoundingClientRect()
      const by = Math.min(dr.bottom - br.bottom + 8, dr.top - br.top)
      if (by > 0) body.scrollTo({ top: body.scrollTop + by, behavior: 'smooth' })
    })
  }
  body.addEventListener('click', e => {   // 「원작과 차이」 표의 주제 링크
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-topic]')
    if (!a) return
    e.preventDefault()
    const j = list.findIndex(t => t.key === a.dataset.topic)
    if (j >= 0) { show(j); btns[j].focus() }
  })
  btns.forEach((b, i) => {
    b.onclick = () => show(i)
    b.onkeydown = e => {   // 위아래 화살표로 주제 넘기기
      const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      if (!d) return
      e.preventDefault(); e.stopPropagation()
      const j = (i + d + btns.length) % btns.length
      show(j); btns[j].focus()
    }
  })
  const i = list.findIndex(t => t.key === at)
  show(i < 0 ? extra.length : i)
  return btns[list.findIndex(t => t.key === lastTopic)]
}

const WIDTH = 560, HEIGHT = 340

/** 전투 메뉴 「도움말」: 왼쪽 주제 목록 + 오른쪽 본문. back = 메뉴에서 열었을 때 「이전」 (오른쪽 클릭·Esc·바깥 누르기도).
 *  o.topic = 열 주제 키 (안내 카드의 「도움말에서 더 보기」), o.label = 버튼 글자, o.extra = 목록 맨 앞 주제 */
export function rulesWin(known: HelpKnown, back?: () => void, o: { topic?: string; label?: string; extra?: HelpTopic[] } = {}) {
  const m = mapRect()
  const leave = () => { closeWin('rules'); back?.() }
  const el = openWin({
    title: '도움말', kind: 'rules', at: 'center', width: Math.min(WIDTH, m.w - 16), dir: 'row', btnW: 64, bodyH: Math.min(HEIGHT, m.h - 90),
    body: '<div class="hwrap"></div>',
    buttons: [[o.label ?? (back ? '이전' : '닫기'), leave]],
    onBack: leave, closeOnPick: false,
  })
  mountHelp(el.querySelector<HTMLElement>('.hwrap')!, known, o.topic, o.extra).focus()
}
