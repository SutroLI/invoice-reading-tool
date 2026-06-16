import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { ParsedInvoice } from '../types'
import { collapseWrappedLines, normalizeText } from './normalize'
import { parseInvoiceText } from './parseInvoiceText'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: buffer }).promise
  const page = await pdf.getPage(1)
  const content = await page.getTextContent()
  const text = content.items
    .map((item) => ('str' in item ? item.str : ''))
    .join('\n')
  return collapseWrappedLines(normalizeText(text))
}

export async function parseInvoicePdf(file: File): Promise<ParsedInvoice> {
  const text = await extractPdfText(file)
  return parseInvoiceText(file.name, text)
}
