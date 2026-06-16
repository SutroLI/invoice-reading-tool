/** Normalize PDF text quirks (ligatures, whitespace). */
export function normalizeText(text: string): string {
  return text
    .replace(/\uFB01/g, 'fi') // ﬁ ligature
    .replace(/\uFB02/g, 'fl')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Collapse line breaks that split a single field name across lines. */
export function collapseWrappedLines(text: string): string {
  return text
    .replace(/Work-From-Home\s*\n\s*Allowance/gi, 'Work-From-Home Allowance')
    .replace(/Health Insurance\s*\n\s*Allowance/gi, 'Health Insurance Allowance')
    .replace(/International Processing\s*\n\s*Fee \(Wire Fee\)/gi, 'International Processing Fee (Wire Fee)')
    .replace(/Benefits Cost \|/g, 'Benefits Cost |')
}

export function parseAmount(value: string): number {
  return parseFloat(value.replace(/,/g, ''))
}
