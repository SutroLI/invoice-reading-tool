import { describe, expect, it } from 'vitest'
import { getInvoiceStatus, groupFlags, hasMappingIssues, summaryNote } from './invoiceStatus'
import type { ProcessedInvoice } from '../types'

function makeInvoice(overrides: Partial<ProcessedInvoice> = {}): ProcessedInvoice {
  return {
    fileName: 'test.pdf',
    contractId: 'D5170-CAN-001',
    employeeName: 'Test User',
    employeeCountry: 'Canada',
    invoiceNumber: '123',
    type: 'Compensation',
    dueDate: '1/1/2026',
    status: 'Paid In Full',
    totalDue: 100,
    invoiceDate: '1/1/2026',
    compensationAndPeo: 100,
    benefits: 0,
    bucket5100: 100,
    bucket5120: 0,
    bucket5130: 0,
    employeeExpenses: 0,
    totalXeroJe: 100,
    check: 0,
    codedLineItems: [],
    flags: [],
    errors: [],
    ...overrides,
  }
}

describe('invoiceStatus', () => {
  it('marks ready when fully mapped', () => {
    const inv = makeInvoice()
    expect(getInvoiceStatus(inv)).toBe('ready')
    expect(summaryNote(inv)).toBe('Ready to export')
  })

  it('groups missing mapping separately from manual', () => {
    const inv = makeInvoice({
      codedLineItems: [
        {
          period: 'MN',
          service: 'Meal Allowance',
          description: 'Meal Allowance',
          usdAmount: 50,
          bucket: 'needs_info',
          xeroAccount: null,
          xeroDepartment: null,
          flag: 'No mapping for "Meal Allowance"',
        },
        {
          period: 'MN',
          service: 'Employee Expense',
          description: 'Expense ID: x',
          usdAmount: 25,
          bucket: 'manual',
          xeroAccount: 'Depends on Expensify Reports',
          xeroDepartment: 'Depends on Expensify Reports',
          flag: 'Code via Expensify — excluded from auto-totals',
        },
      ],
      employeeExpenses: 25,
      check: 25,
      flags: ['Code via Expensify — excluded from auto-totals'],
    })

    const grouped = groupFlags(inv)
    expect(grouped.missingRule).toHaveLength(1)
    expect(grouped.manual).toHaveLength(1)
    expect(hasMappingIssues(inv)).toBe(true)
    expect(getInvoiceStatus(inv)).toBe('needs_review')
    expect(summaryNote(inv)).toContain('Missing mapping: Meal Allowance')
    expect(summaryNote(inv)).not.toMatch(/[—·]/)
  })

  it('treats expensify-only invoices as manual status', () => {
    const inv = makeInvoice({
      totalDue: 25,
      totalXeroJe: 0,
      check: 25,
      codedLineItems: [
        {
          period: 'MN',
          service: 'Employee Expense',
          description: 'Expense ID: x',
          usdAmount: 25,
          bucket: 'manual',
          xeroAccount: 'Depends on Expensify Reports',
          xeroDepartment: 'Depends on Expensify Reports',
        },
      ],
      employeeExpenses: 25,
    })

    expect(getInvoiceStatus(inv)).toBe('manual')
    expect(hasMappingIssues(inv)).toBe(false)
  })
})
