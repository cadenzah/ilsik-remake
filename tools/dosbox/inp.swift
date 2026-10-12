// DOSBox 창 조작 보조 (macOS). tools/dosbox.py 가 build/dosbox/inp 로 컴파일해 쓴다.
// 손쉬운 사용 권한 필요 (CGEvent), 창 캡처는 화면 기록 권한 필요 (screencapture).
// 사용: inp win                       → DOSBox 창 "id x y w h" (없으면 종료 코드 2)
//       inp key <keycode>
//       inp move|click|rmb <x> <y>     (화면 좌표, 포인트)
// 입력 명령은 맨 앞 일반 창이 DOSBox 가 아니면 아무것도 보내지 않는다 (다른 앱에 클릭이 새는 것 방지).
import CoreGraphics
import Foundation

let a = CommandLine.arguments
let wins = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as! [[String: Any]]
let normal = wins.filter { ($0["kCGWindowLayer"] as! Int) == 0 }

if a[1] == "win" {
  guard let w = normal.first(where: { ($0["kCGWindowOwnerName"] as? String) == "DOSBox" }) else { exit(2) }
  let b = w["kCGWindowBounds"] as! [String: Any]
  print(w["kCGWindowNumber"]!, b["X"]!, b["Y"]!, b["Width"]!, b["Height"]!)
  exit(0)
}
if let top = normal.first, (top["kCGWindowOwnerName"] as? String) != "DOSBox" {
  print("ABORT: front window is", top["kCGWindowOwnerName"] ?? "?"); exit(1)
}

let src = CGEventSource(stateID: .hidSystemState)
func post(_ e: CGEvent?) { e?.post(tap: .cghidEventTap); usleep(30000) }

// 작은 걸음으로 옮기며 델타도 채운다 (SDL 은 델타로 게임 커서를 움직인다)
func moveTo(_ p: CGPoint) {
  let c = CGEvent(source: nil)!.location
  let n = max(1, Int(max(abs(p.x - c.x), abs(p.y - c.y)) / 8))
  var prev = c
  for i in 1...n {
    let t = Double(i) / Double(n)
    let q = CGPoint(x: c.x + (p.x - c.x) * t, y: c.y + (p.y - c.y) * t)
    let e = CGEvent(mouseEventSource: src, mouseType: .mouseMoved, mouseCursorPosition: q, mouseButton: .left)!
    e.setIntegerValueField(.mouseEventDeltaX, value: Int64((q.x - prev.x).rounded()))
    e.setIntegerValueField(.mouseEventDeltaY, value: Int64((q.y - prev.y).rounded()))
    e.post(tap: .cghidEventTap); usleep(8000)
    prev = q
  }
}

switch a[1] {
case "key":
  let k = CGKeyCode(Int(a[2])!)
  post(CGEvent(keyboardEventSource: src, virtualKey: k, keyDown: true)); usleep(60000)
  post(CGEvent(keyboardEventSource: src, virtualKey: k, keyDown: false))
case "move", "click", "rmb":
  let p = CGPoint(x: Double(a[2])!, y: Double(a[3])!)
  moveTo(p)
  if a[1] == "click" {
    post(CGEvent(mouseEventSource: src, mouseType: .leftMouseDown, mouseCursorPosition: p, mouseButton: .left)); usleep(80000)
    post(CGEvent(mouseEventSource: src, mouseType: .leftMouseUp, mouseCursorPosition: p, mouseButton: .left))
  } else if a[1] == "rmb" {
    post(CGEvent(mouseEventSource: src, mouseType: .rightMouseDown, mouseCursorPosition: p, mouseButton: .right)); usleep(80000)
    post(CGEvent(mouseEventSource: src, mouseType: .rightMouseUp, mouseCursorPosition: p, mouseButton: .right))
  }
default:
  print("unknown command"); exit(1)
}
