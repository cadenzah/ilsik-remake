// 설정 화면의 음량 슬라이더 (타이틀 설정·정비 화면 설정 두 가지가 같이 쓴다). 켬/끔 스위치 바로 아래 줄에 둔다
import { setMusicOn } from './music'
import { sample, setSoundOn } from './sfx'
import { setVolume, setting, volume, type VolumeKind } from './settings'
import { closeWin, openWin } from './ui'

export const VOLUME_KINDS: VolumeKind[] = ['music', 'sound']
const NAME: Record<VolumeKind, string> = { music: '배경음악', sound: '효과음' }
const SET_ON: Record<VolumeKind, (on: boolean) => void> = { music: setMusicOn, sound: setSoundOn }

/** 「음량 ─○─ 80」 한 줄. 소리를 끈 동안은 못 바꾼다. 효과음은 놓을 때 소리를 한 번 들려 준다 */
export function volumeRow(k: VolumeKind, cls: string, always = false): HTMLElement {   // always = 꺼 둔 동안에도 바꿀 수 있다
  const row = document.createElement('label')
  row.className = cls
  const r = document.createElement('input'), out = document.createElement('b')
  Object.assign(r, { type: 'range', min: '0', max: '100', step: '10', value: String(volume(k)), disabled: !always && !setting(k) })
  r.setAttribute('aria-label', `${NAME[k]} 음량`)
  const show = () => { out.textContent = r.value; r.style.setProperty('--v', `${r.value}%`) }
  show()
  r.oninput = () => { setVolume(k, Number(r.value)); show() }
  if (k === 'sound') r.onchange = () => sample()
  row.append(Object.assign(document.createElement('span'), { textContent: '음량' }), r, out)
  if (r.disabled) row.classList.add('off')
  return row
}

/** 개선판 전투 메뉴 「소리」 창: 배경음악·효과음 켬/끔 + 음량. 바꿔도 창은 그대로 (초점 유지). back = 메뉴에서 열었을 때 「이전」 */
export function soundWin(back?: () => void) {
  const el = openWin({ title: '소리', kind: 'sound', at: 'center', width: 216, dir: 'row', body: '<div class="snd"></div>', bodyH: 2 * 54 + 4,
    buttons: [[back ? '이전' : '닫기', () => back?.()]], onBack: () => { closeWin('sound'); back?.() } })
  const box = el.querySelector<HTMLElement>('.snd')!
  for (const k of VOLUME_KINDS) {
    const b = document.createElement('button')
    b.className = 'obtn opt'
    b.setAttribute('role', 'switch')
    let row = volumeRow(k, 'ovol')
    const draw = () => {
      const on = setting(k)
      b.setAttribute('aria-checked', String(on))
      b.innerHTML = `${NAME[k]}<b>${on ? '켬' : '끔'}</b>`
    }
    b.onclick = e => { e.stopPropagation(); SET_ON[k](!setting(k)); draw(); const r = volumeRow(k, 'ovol'); row.replaceWith(r); row = r }
    draw()
    box.append(b, row)
  }
  box.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
}

/** 원작판 전투 시스템 창 「음악」·「음향」 [켜기][끄기] (원작 [열기][닫기]) + 그 위 음량 (웹 추가). 지금 상태 쪽 버튼을 붉게.
 *  음량은 꺼 둔 동안에도 바꿀 수 있다. 버튼을 누르면 창을 닫고, 음량만 바꿀 때는 제목 ✕·Esc */
export function onOffVolumeWin(k: VolumeKind, title: string) {
  const el = openWin({ title, dir: 'row', btnW: 54, kind: 'sub', at: 'center', width: 172, body: '<div class="snd"></div>', bodyH: 27,
    buttons: [['켜기', () => SET_ON[k](true)], ['끄기', () => SET_ON[k](false)]], onBack: () => closeWin('sub') })
  el.querySelector('.snd')!.append(volumeRow(k, 'ovol', true))
  markOnOff(el, setting(k))
}

/** [켜기][끄기] 중 지금 상태 쪽을 붉게 (원작 창의 고른 버튼 색 .obtn.on) */
export function markOnOff(el: HTMLElement, on: boolean) {
  el.querySelectorAll('.obtn').forEach((b, i) => b.classList.toggle('on', on === (i === 0)))
}
