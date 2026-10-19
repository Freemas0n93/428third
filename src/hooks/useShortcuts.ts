import { useEffect } from 'react'
import { NUDGE_STEP, NUDGE_STEP_LARGE, ROTATE_STEP, useScene } from '../store/scene'

/** Human-readable legend, shown in the Selection panel. */
export const SHORTCUTS: Array<[keys: string, action: string]> = [
  ['Drag', 'move on its floor'],
  ['← → ↑ ↓', `nudge ${NUDGE_STEP} m · ⇧ ${NUDGE_STEP_LARGE} m`],
  ['R · ⇧R', 'rotate 15° · back'],
  ['L', 'lock / unlock'],
  ['⌘D', 'duplicate'],
  ['⌫', 'delete'],
  ['Esc', 'deselect'],
]

function inEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Global keyboard shortcuts for the selected object. Inactive while typing in a field.
 * Arrow directions match the Plan view: → is +X (down the hall), ↑ is −Z (toward the window wall).
 */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inEditable(e.target)) return
      const s = useScene.getState()
      if (e.key === 'Escape') {
        if (s.selectedId) {
          s.select(null)
          e.preventDefault()
        }
        return
      }
      const id = s.selectedId
      if (!id || s.draggingId) return
      const mod = e.metaKey || e.ctrlKey
      const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP

      switch (e.key) {
        case 'ArrowLeft':
          s.nudgeObject(id, -step, 0)
          break
        case 'ArrowRight':
          s.nudgeObject(id, step, 0)
          break
        case 'ArrowUp':
          s.nudgeObject(id, 0, -step)
          break
        case 'ArrowDown':
          s.nudgeObject(id, 0, step)
          break
        case 'r':
        case 'R':
          if (mod) return
          s.rotateObject(id, e.shiftKey ? -ROTATE_STEP : ROTATE_STEP)
          break
        case 'l':
        case 'L':
          if (mod) return
          s.toggleLock(id)
          break
        case 'd':
        case 'D':
          if (!mod) return
          s.duplicateObject(id)
          break
        case 'Backspace':
        case 'Delete':
          s.removeObject(id)
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
