/**
 * Keyboard navigation for channel table.
 * Registers a data-nav-row / data-nav-col attribute convention.
 *
 * Tab / Shift+Tab  — move between columns in the same row, wrapping to next/prev row
 * Enter            — move to the same column one row down (col 3 = notes: Enter inserts newline instead)
 * ArrowDown        — move to the same column one row down
 * ArrowUp          — move to the same column one row up
 */
export function useKeyboardNav() {
  // col 3 is the notes textarea — Enter should insert a newline there, not navigate
  const NOTES_COL = 3

  function onKeydown(e, rowIdx, colIdx, totalCols, onAddRow) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1
      if (nextCol >= 0 && nextCol < totalCols) {
        focusCell(rowIdx, nextCol)
      } else if (!e.shiftKey) {
        // Last col → move to first col of next row
        const moved = focusCell(rowIdx + 1, 0)
        if (!moved && onAddRow) onAddRow()
      } else {
        // First col → move to last col of previous row
        focusCell(rowIdx - 1, totalCols - 1)
      }
      return
    }

    if (e.key === 'ArrowDown' || (e.key === 'Enter' && colIdx !== NOTES_COL)) {
      if (e.key === 'Enter') {
        // Enter in single-line fields: prevent form submission / newline
        e.preventDefault()
      }
      const moved = focusCell(rowIdx + 1, colIdx)
      if (!moved && onAddRow && e.key === 'Enter') onAddRow()
      return
    }

    if (e.key === 'ArrowUp') {
      focusCell(rowIdx - 1, colIdx)
    }
  }

  function focusCell(rowIdx, colIdx) {
    const el = document.querySelector(
      `[data-nav-row="${rowIdx}"] [data-nav-col="${colIdx}"]`
    )
    if (el) { el.focus(); return true }
    return false
  }

  return { onKeydown }
}
