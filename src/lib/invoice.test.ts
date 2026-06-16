import { describe, expect, it } from 'vitest'
import { parseInvoiceText } from '../lib/parseInvoiceText'
import { processInvoice } from '../lib/processInvoice'

const SAMPLE_1919984 = `Velocity Global, LLC d/b/a Pebl
Invoice Date: 5/13/2026 
Due Date: 5/15/2026 
Invoice 1919984
Employee
Contract Currency
Payment Currency
D5170-CAN-001
Canadian Dollar
US Dollar
Conversion Rate
Canadian Dollar
US Dollar
0.751864
SM 2026 Pd 09
Compensation
Base Salary
CAD
6,142.24
4,618.13
SM 2026 Pd 09
Employment Cost
Employment Cost
CAD
1,492.72
1,122.32
Fees
SM 2026 Pd 09
Benefits Cost
Benefits Cost | Canada Life | Standard | Jun 2026
CAD
1,086.25
816.71
SM 2026 Pd 09
Benefits Cost
Benefits Cost | Canada Life | Life | Jun 2026
CAD
60.15
45.22
SM 2026 Pd 09
EOR Service Fee
Monthly International Fee
USD
599.00
599.00
SM 2026 Pd 09
International Processing Fee (Wire Fee)
International Processing Fee (Wire Fee) (Canada)
USD
45.00
45.00
Total Due in USD
7,246.38`

const SAMPLE_1924355 = `Invoice Date: 5/18/2026 
Due Date: 5/20/2026 
Invoice 1924355
Employee
Contract Currency
Payment Currency
D5170-KOR-001
Conversion Rate
Won
US Dollar
0.000688
MN 2026 05
Compensation
Base Salary
KRW
10,921,850
7,511.54
MN 2026 05
Employment Cost
Employment Cost
KRW
2,503,533
1,721.81
MN 2026 05
Meal Allowance
Meal Allowance
KRW
200,000
137.55
Fees
MN 2026 05
EOR Service Fee
Monthly International Fee
USD
599.00
599.00
MN 2026 05
International Processing Fee (Wire Fee)
International Processing Fee (Wire Fee) (Korea (the Republic of))
USD
45.00
45.00
Total Due in USD
10,014.90`

const SAMPLE_1923536 = `Invoice Date: 5/15/2026 
Due Date: 5/19/2026 
Invoice 1923536
D5170-NOR-002
Conversion Rate
Norwegian Krone
US Dollar
0.110324
MN 2026 05
Compensation
Base Salary
NOK
83,762.74
9,241.07
MN 2026 05
Employee Expense
Expense ID: R00ZhkVwVxMD
NOK
1,044.90
115.28
MN 2026 05
Employment Cost
Employment Cost
NOK
17,774.89
1,960.99
MN 2026 05
Expense to be Grossed Up
Expense to be Grossed Up
NOK
2,724.00
300.52
Fees
MN 2026 05
Benefits Cost
Benefits Cost | MSH | Life | Jun 2026
USD
50.30
50.30
MN 2026 05
EOR Service Fee
Monthly International Fee
USD
599.00
599.00
Total Due in USD
12,267.16`

describe('parseInvoiceText', () => {
  it('parses standard Canada invoice', () => {
    const parsed = parseInvoiceText('test.pdf', SAMPLE_1919984)
    expect(parsed.invoiceNumber).toBe('1919984')
    expect(parsed.contractId).toBe('D5170-CAN-001')
    expect(parsed.totalDue).toBe(7246.38)
    expect(parsed.lineItems).toHaveLength(6)
  })

  it('parses meal allowance invoice', () => {
    const parsed = parseInvoiceText('test.pdf', SAMPLE_1924355)
    expect(parsed.lineItems.some((li) => li.service === 'Meal Allowance')).toBe(true)
  })

  it('parses total due when pdf.js inserts a blank line', () => {
    const text = `Invoice 1919986
D5170-CAN-002
Conversion Rate
MN 2026 05
Compensation
Base Salary
CAD
4,863.08
3,656.37
Total Due in USD
 
5,665.47`
    const parsed = parseInvoiceText('test.pdf', text)
    expect(parsed.totalDue).toBe(5665.47)
  })
})

describe('processInvoice', () => {
  it('codes Canada invoice with zero check', () => {
    const parsed = parseInvoiceText('test.pdf', SAMPLE_1919984)
    const result = processInvoice(parsed)
    expect(result.employeeName).toBe('Bronwen Tucker')
    expect(result.bucket5100).toBe(4618.13)
    expect(result.bucket5130).toBe(644)
    expect(result.check).toBe(0)
  })

  it('flags meal allowance as needs_info', () => {
    const parsed = parseInvoiceText('test.pdf', SAMPLE_1924355)
    const result = processInvoice(parsed)
    const meal = result.codedLineItems.find((li) => li.service === 'Meal Allowance')
    expect(meal?.bucket).toBe('needs_info')
    expect(result.flags.some((f) => f.includes('Meal Allowance'))).toBe(true)
  })

  it('excludes employee expense from auto-coded total', () => {
    const parsed = parseInvoiceText('test.pdf', SAMPLE_1923536)
    const result = processInvoice(parsed)
    expect(result.employeeExpenses).toBe(115.28)
    expect(result.check).toBe(115.28)
  })
})
