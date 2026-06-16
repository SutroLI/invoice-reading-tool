import { readFileSync } from 'fs'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { collapseWrappedLines, normalizeText } from '../src/lib/normalize.ts'
import { parseInvoiceText } from '../src/lib/parseInvoiceText.ts'
import { processInvoice } from '../src/lib/processInvoice.ts'
import { summaryNote } from '../src/lib/invoiceStatus.ts'

GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).href

const pdfs = process.argv.slice(2)

async function main() {
  for (const path of pdfs) {
    const buffer = new Uint8Array(readFileSync(path))
    const pdf = await getDocument({ data: buffer }).promise
    const page = await pdf.getPage(1)
    const content = await page.getTextContent()
    const raw = content.items.map((i) => i.str ?? '').join('\n')
    const text = collapseWrappedLines(normalizeText(raw))
    const parsed = parseInvoiceText(path.split('/').pop(), text)
    const result = processInvoice(parsed)
    const sumLines = parsed.lineItems.reduce((s, li) => s + li.usdAmount, 0)

    console.log('\n===', path.split('/').pop(), '===')
    console.log('line items:', parsed.lineItems.length)
    console.log('sum of lines:', sumLines.toFixed(2), '| total due:', parsed.totalDue)
    console.log(
      '5100:',
      result.bucket5100,
      '5120:',
      result.bucket5120,
      '5130:',
      result.bucket5130,
      'manual:',
      result.employeeExpenses,
    )
    console.log('totalXeroJe:', result.totalXeroJe, '| check:', result.check)
    console.log(
      'unmapped:',
      result.codedLineItems
        .filter((li) => li.bucket === 'needs_info')
        .map((li) => `${li.service} ($${li.usdAmount})`),
    )
    console.log('note:', summaryNote(result))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
