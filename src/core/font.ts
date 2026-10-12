// 설정 '원작 글꼴': 원작 FULLSOFT.FNT (formats.md "FULLSOFT.FNT 글꼴") 를 옮긴 웹 글꼴 "Eclipse Bitmap" 을 화면 전체에 쓴다.
// 켜고 끄기 = <html class="bmfont"> → CSS 변수 --font (style.css). 16px 일 때 원작 픽셀 크기 (한글 16×15, 영문 8×15)
import { setting } from './settings'

/** 지금 설정대로 글꼴을 바꾼다. 원작 글꼴이면 미리 불러 둬 캔버스 글자도 같은 글꼴로 그린다 */
export function applyFont(on = setting('bitmapFont')) {
  document.documentElement.classList.toggle('bmfont', on)
  if (on) void document.fonts?.load('16px "Eclipse Bitmap"', '가A')
}

/** 캔버스 글자용 글꼴 이름 목록 (CSS 변수 --font) */
export const fontFamily = () => getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'sans-serif'
