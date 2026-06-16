import type { ProcessedInvoice } from '../types'

export type FlagCategory = 'missing_rule' | 'manual' | 'unknown_employee' | 'error' | 'check'

export interface GroupedFlags {
  missingRule: string[]
  manual: string[]
  unknownEmployee: string[]
  errors: string[]
  checkNote: string | null
}

export type InvoiceStatus = 'ready' | 'manual' | 'needs_review' | 'error'

export function groupFlags(inv: ProcessedInvoice): GroupedFlags {
  const missingRule: string[] = []
  const manual: string[] = []
  const unknownEmployee: string[] = []

  for (const item of inv.codedLineItems) {
    if (item.bucket === 'needs_info' && item.flag) {
      missingRule.push(item.flag)
    } else if (item.bucket === 'manual') {
      manual.push(
        `${item.service}: ${formatMoney(item.usdAmount)} - code in Expensify`,
      )
    }
  }

  for (const flag of inv.flags) {
    if (flag.startsWith('Unknown contract ID:')) {
      unknownEmployee.push(flag)
    }
  }

  let checkNote: string | null = null
  if (inv.errors.length === 0 && Math.abs(inv.check) >= 0.01) {
    const explainedByExpense =
      inv.employeeExpenses > 0 && Math.abs(inv.check - inv.employeeExpenses) < 0.01
    if (!explainedByExpense) {
      checkNote = `Check is ${formatMoney(inv.check)} - totals do not reconcile`
    }
  }

  return {
    missingRule,
    manual,
    unknownEmployee,
    errors: [...inv.errors],
    checkNote,
  }
}

export function getInvoiceStatus(inv: ProcessedInvoice): InvoiceStatus {
  const grouped = groupFlags(inv)

  if (grouped.errors.length > 0) return 'error'
  if (grouped.missingRule.length > 0 || grouped.unknownEmployee.length > 0 || grouped.checkNote) {
    return 'needs_review'
  }
  if (grouped.manual.length > 0) return 'manual'
  return 'ready'
}

export function hasMappingIssues(inv: ProcessedInvoice): boolean {
  const status = getInvoiceStatus(inv)
  return status === 'needs_review' || status === 'error'
}

export function summaryNote(inv: ProcessedInvoice): string {
  const grouped = groupFlags(inv)
  const parts: string[] = []

  if (grouped.missingRule.length > 0) {
    const services = [
      ...new Set(
        inv.codedLineItems
          .filter((li) => li.bucket === 'needs_info')
          .map((li) => li.service),
      ),
    ]
    parts.push(`Missing mapping: ${services.join(', ')}`)
  }

  if (grouped.unknownEmployee.length > 0) {
    parts.push(grouped.unknownEmployee[0])
  }

  if (grouped.manual.length > 0) {
    const total = inv.employeeExpenses
    parts.push(`Employee expense ${formatMoney(total)} - code in Expensify`)
  }

  if (grouped.checkNote) {
    parts.push(grouped.checkNote)
  }

  if (grouped.errors.length > 0) {
    parts.push(grouped.errors[0])
  }

  return parts.join('; ') || 'Ready to export'
}

export function sortInvoices(invoices: ProcessedInvoice[]): ProcessedInvoice[] {
  return [...invoices].sort((a, b) => {
    const aIssue = hasMappingIssues(a) ? 0 : 1
    const bIssue = hasMappingIssues(b) ? 0 : 1
    if (aIssue !== bIssue) return aIssue - bIssue
    return a.invoiceNumber.localeCompare(b.invoiceNumber)
  })
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
