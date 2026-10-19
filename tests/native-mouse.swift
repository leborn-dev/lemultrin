// Exercise only the disposable Electron smoke window; restore cursor afterward.
import CoreGraphics
import Foundation
let x = Double(CommandLine.arguments[1])!
let y = Double(CommandLine.arguments[2])!
let original = CGEvent(source: nil)?.location
func post(_ type: CGEventType, _ px: Double, _ py: Double) {
  CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: CGPoint(x: px, y: py), mouseButton: .left)?.post(tap: .cghidEventTap)
  usleep(100_000)
}
post(.mouseMoved,x,y)
post(.leftMouseDown,x,y)
post(.leftMouseDragged,x+10,y+10)
post(.leftMouseUp,x+10,y+10)
if let position = original { post(.mouseMoved,position.x,position.y) }
