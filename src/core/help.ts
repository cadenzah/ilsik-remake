// 개선판 규칙 도움말 (B1 제안 N5, balance-proposal.md "N5 규칙 도움말"). 전투 메뉴 「도움말」과 도감에서 본다 (2026-11-06 「규칙」 → 「도움말」). 문구는 짧게, 내부 계수·배율은 쓰지 않는다 (2026-11-06 정리).
// 수치의 근거 = editions/original/rules.ts (피로 계수·휴식·행동 뒤 피로·aiRests·actsTwice), core/attack.ts (사격·범위), core/battleCore.ts counterDamage (반격), core/grid.ts reachable (통제 영역), editions/remake/growth.ts (성장·쓰러진 대가)
// 규칙을 바꾸면 여기도 고친다. 피로 % = 공격 계수 (2.6 − F) · 방어 계수 (2.4 − F) 의 피로 0 대비 감소 (30: 18·20, 50: 34·37, 70: 54·59)
import { mapRect } from './screen'
import { closeWin, openWin, type Btn } from './ui'

export const RULE_PAGES: { title: string; lines: string[] }[] = [
  { title: '피로', lines: [
    '피로가 쌓일수록 공격과 방어가 함께 떨어진다.',
    '공격·반격하면 4~8, 움직이면 한 칸에 1, 마법은 목록에 적힌 만큼 쌓인다. 맞기만 해서는 쌓이지 않는다.',
    '부하상태가 낮을수록 공격과 마법으로 쌓이는 피로가 많다.',
    '움직이지도 치지도 않고 차례를 마치면 쉬면서 생명과 피로를 회복한다.',
    '레벨이 오르면 피로가 0이 된다. 생명회복 마법을 받아도 줄어든다.',
    '지금 피로와 마법의 피로를 더해 90을 넘으면 그 마법은 쓸 수 없다.',
  ] },
  { title: '전투', lines: [
    '공격과 마법에 운은 없다. 확인창의 숫자대로 들어간다.',
    '근접 공격을 맞고 살아남으면 공격자를 되받아친다. 피해는 직접 칠 때와 같고, 몇 번을 되받아도 약해지지 않는다. 적도 같다.',
    '피로가 70을 넘었거나 생명이 ¼ 이하이거나 혼수·대기 상태면 되받지 못한다. 기사·포수·궁수·추전수의 공격과 마법은 되받지 않는다.',
    '적 바로 옆 칸에 들어가면 이동이 거기서 멈춘다. 적도 같다. 비행하는 유닛과 도둑은 멈추지 않고, 혼수에 빠진 유닛 옆에서는 멈추지 않는다.',
    '선두가 쓰러지면 패배다. 적은 쓰러뜨릴 수 있는 대상부터 노린다.',
    '적과 NPC도 피로가 70을 넘거나 생명이 ¼ 이하면 그 차례에 쉰다. 일행이 닿지 않는 곳이 있으면 그리로 물러나서 쉰다.',
    '보스는 자리를 지키다가 그 차례에 닿는 상대가 있을 때만 움직인다.',
    '적 부대는 발을 맞춰 다가오고, 누구 하나가 싸우기 시작하면 모두 달려든다. 회복 마법을 쓰는 대원을 먼저 노린다.',
    '경계 중인 적은 가까이 가거나 공격하면 깨어난다. 위험 범위를 켜면 청록색으로 보인다.',
    '대기 중인 적은 정해진 때가 오기 전에는 맞아도 움직이지 않는다.',
    '중독되면 3차례 동안 차례마다 생명의 ⅓을 잃는다. 혼수에 빠지면 3차례 동안 아무것도 못 한다.',
  ] },
  { title: '직업', lines: [
    '포수·궁수·추전수는 가로나 세로 일직선으로만 쏜다.',
    '포수는 맞은 칸 둘레까지 함께 맞힌다. 같은 편도 맞는다.',
    '기사는 자신이나 같은 편을 하나 골라 그 둘레의 적을 친다.',
    '생명상해 마법은 대상의 정신이 높을수록 덜 든다. 방어만 높은 적에게 잘 든다.',
    '혜유가 질풍화를 차고 민첩이 61 이상이면 한 차례에 두 번 움직인다.',
  ] },
  { title: '성장', lines: [
    '경험치 100이면 레벨이 오른다. 레벨 높은 적일수록, 마무리 일격일수록 많이 받는다.',
    '출전하지 않은 동료도 이긴 장에서 경험치를 조금 받는다.',
    '늦게 합류한 동료는 일행에 가까운 레벨로 합류한다.',
    '전직하거나 바꿔 넣어도 레벨은 이어진다.',
    '이긴 장에서 쓰러진 대원은 그 장에서 얻은 성장을 잃고, 다음 장을 지친 채로 시작한다.',
    '난이도는 적이 주는 피해를 바꾼다. 설정에서 언제든 바꿀 수 있다.',
  ] },
]

const WIDTH = 500

/** 전투 메뉴 「도움말」: 위쪽 쪽 이름 버튼으로 넘긴다. back = 메뉴에서 열었을 때 「이전」 (오른쪽 클릭·Esc·바깥 누르기도) */
export function rulesWin(page = 0, back?: () => void) {
  const { lines } = RULE_PAGES[page]
  const m = mapRect()
  const leave = () => { closeWin('rules'); back?.() }
  const open = (bodyH?: number) => openWin({
    title: '도움말', kind: 'rules', at: 'center', width: Math.min(WIDTH, m.w - 16), dir: 'row', btnW: 64, bodyH,
    body: `<div class="rules">${lines.map(l => `<div>· ${l}</div>`).join('')}</div>`,
    buttons: [...RULE_PAGES.map((p, i): Btn => [p.title, () => rulesWin(i, back), { disabled: i === page }]), [back ? '이전' : '닫기', leave]],
    onBack: leave, closeOnPick: false,
  })
  // 창 높이는 글자 수 어림이라 줄바꿈이 많으면 모자란다 → 그려 본 높이로 다시 연다. 맵 창보다 길면 맵 창에 맞추고 본문을 스크롤
  const body = open().querySelector<HTMLElement>('.b')!
  if (body.scrollHeight !== body.clientHeight) open(Math.min(body.scrollHeight, m.h - 90))
}
