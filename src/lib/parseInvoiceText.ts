import type { LineItem, ParsedInvoice } from '../types'
import { parseAmount } from './normalize'

const PAYROLL_PERIOD_RE = /^(SM \d{4} Pd \d{2}|MN \d{4} \d{2})$/
const CURRENCY_RE = /^(USD|EUR|CAD|NOK|KRW|Won|Indonesian Rupiah)$/

function normalizeServiceName(service: string, description: string): string {
  const combined = `${service} ${description}`.replace(/\s+/g, ' ').trim()

  if (/work[- ]from[- ]home/i.test(combined)) return 'Work-From-Home Allowance'
  if (/health insurance allowance/i.test(combined)) return 'Health Insurance Allowance'
  if (/international processing fee/i.test(combined)) return 'International Processing Fee (Wire Fee)'
  if (/^wire transfer fee$/i.test(service.trim())) return 'Wire Transfer Fee'
  if (/benefits cost/i.test(service)) return 'Benefits Cost'
  if (/compensation \(v\/a\)/i.test(service)) return 'Compensation (V/A)'

  return service.replace(/\s+/g, ' ').trim()
}

function parseLineItems(text: string): LineItem[] {
  const start = text.indexOf('Conversion Rate')
  const end = text.indexOf('Total Due in USD')
  if (start < 0 || end < 0) return []

  let section = text.slice(start, end)
  const periodStart = section.search(/SM \d{4} Pd \d{2}|MN \d{4} \d{2}/)
  if (periodStart >= 0) section = section.slice(periodStart)

  const chunks = section.split(/\n(?=SM \d{4} Pd \d{2}\n|MN \d{4} \d{2}\n)/)
  const items: LineItem[] = []

  for (const chunk of chunks) {
    const lines = chunk
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && l !== 'Fees')

    if (lines.length < 2) continue

    const period = lines[0]
    if (!PAYROLL_PERIOD_RE.test(period)) continue

    const numericTail: string[] = []
    const middle: string[] = []

    for (let i = lines.length - 1; i >= 1; i--) {
      const line = lines[i]
      if (/^[\d,]+\.?\d*$/.test(line)) {
        numericTail.unshift(line)
        if (numericTail.length === 2) {
          middle.push(...lines.slice(1, i))
          break
        }
      } else if (CURRENCY_RE.test(line)) {
        continue
      } else if (numericTail.length < 2) {
        middle.unshift(line)
      }
    }

    if (numericTail.length < 2 || middle.length === 0) continue

    const service = middle[0]
    const description = middle.slice(1).join(' ').trim()
    const usdAmount = parseAmount(numericTail[1])

    items.push({
      period,
      service: normalizeServiceName(service, description),
      description,
      usdAmount,
    })
  }

  return items
}

export function parseInvoiceText(fileName: string, text: string): ParsedInvoice {
  const invoiceNumber = text.match(/Invoice\s+(\d+)/)?.[1] ?? ''
  const invoiceDate = text.match(/Invoice Date:\s*([\d/]+)/)?.[1] ?? ''
  const dueDate = text.match(/Due Date:\s*([\d/]+)/)?.[1] ?? ''
  const contractId =
    text.match(
      /Invoice \d+\nEmployee\nContract Currency\nPayment Currency\n(D5170-[A-Z]{3}-\d{3})/,
    )?.[1] ??
    text.match(/(D5170-[A-Z]{3}-\d{3})/)?.[1] ??
    ''
  const totalDue = parseAmount(
    text.match(/Total Due in USD\n([\d,]+\.?\d*)/)?.[1] ?? '0',
  )
  const lineItems = parseLineItems(text)

  return {
    fileName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    contractId,
    totalDue,
    lineItems,
    rawText: text,
  }
}
