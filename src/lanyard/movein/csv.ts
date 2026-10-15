import { Buffer } from 'node:buffer'
import { canonicalJson, sha256 } from '../../modules/import-kit/src/d1/index.ts'
import type { SourceBundle, SourceRecord } from '../../modules/import-kit/src/types.ts'
import { ImportError, requiredText } from './errors'

export const namespace = 'lanyard.staff.csv.v1'
const columns = ['staff_id', 'name', 'email', 'payroll_id']

/** RFC 4180 quoting, including quoted line breaks. Row numbers are physical start lines. */
function parse(text: string): { cells: string[]; line: number }[] {
  const rows: { cells: string[]; line: number }[] = []
  let cells: string[] = [], cell = '', state: 'plain' | 'quoted' | 'closed' = 'plain', line = 1, start = 1
  const push = () => { cells.push(cell); rows.push({ cells, line: start }); cells = []; cell = ''; state = 'plain' }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (state === 'quoted') {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else state = 'closed' }
      else { cell += ch; if (ch === '\n') line++ }
      continue
    }
    if (ch === '"') {
      if (state !== 'plain' || cell) throw new ImportError('invalid_csv', 422, `Unexpected quote at line ${line}`)
      state = 'quoted'; continue
    }
    if (ch === ',') { cells.push(cell); cell = ''; state = 'plain'; continue }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      push(); line++; start = line; continue
    }
    if (state === 'closed') throw new ImportError('invalid_csv', 422, `Unexpected text after a quote at line ${line}`)
    cell += ch
  }
  if (state === 'quoted') throw new ImportError('invalid_csv', 422, 'Unclosed CSV quote')
  if (cell || cells.length || state === 'closed') push()
  return rows
}

export function staffSource(value: unknown): SourceBundle {
  const csv = requiredText(value, 'csv'), bytes = Buffer.from(csv, 'utf8')
  if (bytes.length > 100_000) throw new ImportError('csv_too_large', 413, 'Staff CSV is limited to 100,000 UTF-8 bytes')
  if (csv.includes('\0')) throw new ImportError('invalid_csv', 422)
  const rows = parse(csv.replace(/^\uFEFF/, ''))
  if (!rows.length || rows[0].cells.length !== columns.length || rows[0].cells.some((v, i) => v !== columns[i])) {
    throw new ImportError('invalid_csv_headers', 422, `Use these exact headers: ${columns.join(',')}`)
  }
  const body = rows.slice(1)
  if (!body.length || body.length > 100) throw new ImportError('invalid_staff_count', 422, 'Import between 1 and 100 staff rows')
  const ids = new Set<string>(), emails = new Set<string>(), payrollIds = new Set<string>()
  const artifactHash = sha256(bytes)
  const records: SourceRecord[] = body.map(({ cells, line }) => {
    if (cells.length !== 4) throw new ImportError('invalid_csv_row', 422, `Line ${line} must have four cells`)
    const [id, name, rawEmail, rawPayroll] = cells.map(v => v.trim())
    const email = rawEmail.toLowerCase(), payroll = rawPayroll || null
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !name || name.length > 200 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (payroll?.length ?? 0) > 100) {
      throw new ImportError('invalid_staff_row', 422, `Invalid staff fields at line ${line}`)
    }
    if (ids.has(id) || emails.has(email) || (payroll !== null && payrollIds.has(payroll))) {
      throw new ImportError('duplicate_staff', 422, `Duplicate staff ID, email or payroll ID at line ${line}`)
    }
    ids.add(id); emails.add(email); if (payroll) payrollIds.add(payroll)
    const payload = { id, name, email, payroll_id: payroll }
    return { namespace, kind: 'staff', sourceId: id, payload, payloadHash: sha256(canonicalJson(payload)), artifactHash, location: { artifact: 'staff.csv', row: line } }
  })
  return { records, diagnostics: [], artifacts: [{ name: 'staff.csv', sha256: artifactHash, size: bytes.length, original: { status: 'available', base64: bytes.toString('base64') } }] }
}
