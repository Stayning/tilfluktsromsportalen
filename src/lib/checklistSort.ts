// Compare dotted numeric IDs like "4.1", "4.10", "5.2" in natural order.
// A missing/shorter segment sorts before a present one ("4" before "4.1").
// Non-numeric parts fall back to lexicographic compare, so UUIDs / strings
// also sort deterministically.
export function compareChecklistItemIds(a: string, b: string): number {
  const segA = a.split('.')
  const segB = b.split('.')
  const len = Math.max(segA.length, segB.length)
  for (let i = 0; i < len; i++) {
    const sA = segA[i]
    const sB = segB[i]
    if (sA === undefined) return -1
    if (sB === undefined) return 1
    const nA = Number(sA)
    const nB = Number(sB)
    const bothNumeric =
      sA !== '' && sB !== '' && Number.isFinite(nA) && Number.isFinite(nB)
    if (bothNumeric) {
      if (nA !== nB) return nA - nB
    } else {
      const cmp = sA.localeCompare(sB)
      if (cmp !== 0) return cmp
    }
  }
  return 0
}
