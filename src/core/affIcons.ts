// 상성 아이콘 (개선판, 2026-11-08): 전투 중 마우스 올림 창 (info.ts showBasic) 이름 줄과 도움말 「약점·내성」 범례.
// 약점·내성을 글로 늘어놓지 않고 까닭 (종족·비행·시전 계열·중갑) 만 그림으로 — 무엇에 약한지는 그림에서 짐작하거나 도움말·확인창에서 본다.
// 키 = remake/affinity.ts affinityMarks. 16×16 SVG, 색 = 계열을 떠올리게 (빛 금색·어둠 보라·바람 초록·물 파랑·불 빨강·땅 갈색)
import { esc } from './ui'

type Icon = { label: string; color: string; svg: string }
const P = (d: string, evenodd = false) => `<path${evenodd ? ' fill-rule="evenodd"' : ''} d="${d}"/>`
const S = (d: string, w = 1.7) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`

export const AFF_ICONS: Record<string, Icon> = {
  undead: { label: '불사족', color: '#55524c', svg: P('M8 1.5C4.4 1.5 2 3.9 2 7c0 1.9.9 3.3 2.2 4.1V14h1.6v-1.5h1.4V14h1.6v-1.5h1.4V14h1.6v-2.9C13.1 10.3 14 8.9 14 7c0-3.1-2.4-5.5-6-5.5zM5.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z', true) },
  demon: { label: '마족', color: '#8c1c2c', svg: P('M1.5 1l2.8 4.4C3.5 6.3 3 7.5 3 8.8 3 11.7 5.2 14.5 8 14.5s5-2.8 5-5.7c0-1.3-.5-2.5-1.3-3.4L14.5 1 10.2 4.2C9.5 4 8.8 3.9 8 3.9s-1.5.1-2.2.3zM5 8.2l2 1-2 1zm6 0l-2 1 2 1z', true) },
  dragon: { label: '용족', color: '#9a5a12', svg: P('M1 8c2-3.6 4.6-5.2 7-5.2S13 4.4 15 8c-2 3.6-4.6 5.2-7 5.2S3 11.6 1 8zm6.3-3.6v7.2h1.4V4.4z', true) },
  sea: { label: '해족', color: '#16707e', svg: P('M1 8c2.4-3 5.4-4.2 8.6-3.3L14.5 2v12l-4.9-2.7C6.4 12.2 3.4 11 1 8zm3.4-.9a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z', true) },
  ice: { label: '빙마녀', color: '#3c8cc8', svg: S('M8 1v14M2 4.5l12 7M2 11.5l12-7M6.3 2.3L8 4l1.7-1.7M6.3 13.7L8 12l1.7 1.7') },
  machine: { label: '기계', color: '#5c6470', svg: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-dasharray="2.3 2.1"/><circle cx="8" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/>' },
  fly: { label: '비행', color: '#3c5a88', svg: P('M1.5 3C6 3.2 10 4.4 14.6 2.4c-.5 2.6-2 4.1-4 4.8 1.4.2 2.5 0 3.5-.4-1 1.9-2.8 2.9-5 3.1 1 .4 2 .5 3 .3-1.5 1.7-4 2.7-6.5 2.4C3.3 12.3 1.4 9.6 1.5 3z') },
  el0: { label: '빛 마법', color: '#b88400', svg: '<circle cx="8" cy="8" r="3" fill="currentColor"/>' + S('M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3', 1.5) },
  el1: { label: '어둠 마법', color: '#5a2c8c', svg: P('M10.2 1.5A6.5 6.5 0 1 0 14.5 11a5.2 5.2 0 0 1-4.3-9.5z') },
  el2: { label: '바람 마법', color: '#2a8040', svg: S('M1.5 6h8.5a2.2 2.2 0 1 0-2.2-2.2M1.5 10h10.5a2.2 2.2 0 1 1-2.2 2.2M1.5 8h5') },
  el3: { label: '물 마법', color: '#1e58b8', svg: P('M8 1.2C6 4.8 3.4 7.4 3.4 10.2a4.6 4.6 0 0 0 9.2 0C12.6 7.4 10 4.8 8 1.2z') },
  el4: { label: '불 마법', color: '#d03c0c', svg: P('M8 .8c.6 2.6 4.7 4.6 4.7 8.6a4.7 4.7 0 0 1-9.4 0c0-2 1-3.6 2.1-4.6 0 1.6.8 2.6 1.9 3C6.8 5.4 7 2.9 8 .8z') },
  el5: { label: '땅 마법', color: '#7c5224', svg: P('M.8 14.5l4.7-8.2 2.6 3.6 2.8-5.6 4.3 10.2z') },
  heavy: { label: '중갑', color: '#4a5262', svg: P('M8 1l6 2.2v4.3c0 3.6-2.5 6.3-6 7.5-3.5-1.2-6-3.9-6-7.5V3.2zM8 3v10.3c2.4-1 4-3.1 4-5.8V4.6z', true) },
  // 공격 쪽: 활 (궁수·추전수, 약점·내성 칸). 상성이 없는 계열 (소환·노래·기원) 은 마법 목록에만
  bow: { label: '활', color: '#6a4a22', svg: S('M4 1.5c5 2 7.5 6 6 13M4 1.5l0 13M10 14.5L4 14.5M1.5 8h12M11 5.8L13.8 8 11 10.2', 1.4) },
  el6: { label: '소환 마법', color: '#6b4bb8', svg: P('M8 1.5l1.9 4.6 4.9.4-3.7 3.2 1.1 4.8L8 11.9l-4.2 2.6 1.1-4.8L1.2 6.5l4.9-.4z') },
  el7: { label: '노래 마법', color: '#a0307a', svg: P('M5.4 2.6l8-1.7v9.4a2.3 2.3 0 1 1-1.6-2.2V3.9L7 4.9v7.4a2.3 2.3 0 1 1-1.6-2.2z') },
  el8: { label: '기원 마법', color: '#a07800', svg: P('M7.5 2.5l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5L6 10 1.5 8.5 6 7zM13 1l.6 1.4 1.4.6-1.4.6L13 5l-.6-1.4L11 3l1.4-.6z') },
}
/** 계열 (Magic.school) 아이콘 키. 빛 0 어둠 1 바람 2 물 3 불 4 땅 5 소환 6 노래 7 기원 8 */
export const schoolIcon = (school: number) => affIcon(`el${school}`)

/** 아이콘 하나 (글줄 안, 16px). 없는 키면 빈 글 */
export function affIcon(key: string) {
  const i = AFF_ICONS[key]
  return !i ? '' : `<svg class="aff-ic" viewBox="0 0 16 16" fill="currentColor" style="color:${i.color}" role="img" aria-label="${esc(i.label)}"><title>${esc(i.label)}</title>${i.svg}</svg>`
}
export const affIcons = (keys: string[]) => keys.length ? `<span class="aff-ics">${keys.map(affIcon).join('')}</span>` : ''

/** 「특히 크게 듦」 표 (아이콘 바로 오른쪽, 같은 줄). 비트맵 글꼴의 + 는 ㅏ 처럼 보여 그림으로 (2026-11-08 사용자) */
export const plusMark = '<svg class="aff-plus" viewBox="0 0 12 12" role="img" aria-label="특히 크게"><title>특히 크게</title><circle cx="6" cy="6" r="5.5" fill="#2f9a40"/><path d="M5.1 2.8h1.8v2.3h2.3v1.8H6.9v2.3H5.1V6.9H2.8V5.1h2.3z" fill="#fff"/></svg>'
/** 약점·내성 줄: 키 = AFF_ICONS 키 ('el3' 물, 'bow' 활), 끝에 '+' 면 특히 크게 듦. 확인창과 같은 색 (약점 초록 · 내성 빨강) */
export function weakResist(weak: string[], resist: string[]) {
  const ic = (k: string) => k.endsWith('+') ? `${affIcon(k.slice(0, -1))}${plusMark}` : affIcon(k)
  const group = (cls: string, name: string, ks: string[]) => ks.length ? `<span class="aff-g"><span class="${cls}">${name}</span>${ks.map(ic).join('')}</span>` : ''
  return `<span class="aff-wr">${group('aff-w', '약점', weak)}${group('aff-r', '내성', resist)}</span>`
}
/** 반대 계열 세 쌍 (물↔불 · 바람↔땅 · 빛↔어둠) */
export const opposePairs = () => `<span class="aff-pairs">${[[3, 4], [2, 5], [0, 1]].map(([a, b]) => `<span>${schoolIcon(a)}↔${schoolIcon(b)}</span>`).join('')}</span>`
