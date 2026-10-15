import { sha256 } from '../../modules/import-kit/src/d1/index.ts'
import type { D1Database, D1Sql, D1TargetAdapter, TargetRow } from '../../modules/import-kit/src/d1/index.ts'
import { ImportError } from './errors'

export const destination = 'lanyard:staff'
export const mappingVersion = 'staff-csv-v1'
export const staffFields = ['id', 'name', 'email', 'payroll_id', 'role', 'active', 'version', 'erased_at'] as const
// Dependence, including exported batch lines, is part of the complete native snapshot.
const inUse = `(EXISTS(SELECT 1 FROM l_records d WHERE json_extract(d.data,'$.staffId')=s.id)
 OR EXISTS(SELECT 1 FROM l_records b,json_each(b.data,'$.lines') line WHERE b.kind='batches' AND json_extract(line.value,'$.staffId')=s.id))`
const select = `SELECT s.*,r.revision AS import_revision,${inUse} AS in_use FROM l_staff s LEFT JOIN l_import_staff_revisions r ON r.staff_id=s.id`
const sql = (sql: string, ...params: unknown[]): D1Sql => ({ sql, params })
function scope(dest: string, kind: string) {
  if (dest !== destination || kind !== 'staff') throw new ImportError('invalid_import_target', 409)
}
function target(row: Record<string, any>): TargetRow {
  return { destination, targetKind: 'staff', targetId: row.id, revision: row.import_revision ?? `native:${row.version}`,
    value: { ...Object.fromEntries(staffFields.map(key => [key, row[key]])), inUse: Boolean(row.in_use) } }
}

export const staffTargets: D1TargetAdapter = {
  async read(db, dest, kind, id) {
    scope(dest, kind)
    const row = await db.prepare(`${select} WHERE s.id=?`).bind(id).first()
    return row ? target(row) : undefined
  },
  matches(row, dest, kind, id) {
    scope(dest, kind)
    if (!row) return sql('NOT EXISTS(SELECT 1 FROM l_staff WHERE id=?) AND NOT EXISTS(SELECT 1 FROM l_import_staff_revisions WHERE staff_id=?)', id, id)
    const v = row.value as Record<string, any>
    return sql(`EXISTS(SELECT 1 FROM l_staff s LEFT JOIN l_import_staff_revisions r ON r.staff_id=s.id WHERE s.id=?
      AND ${staffFields.map(key => `s.${key} IS ?`).join(' AND ')}
      AND COALESCE(r.revision,'native:'||s.version)=? AND ${inUse}=?)`,
      id, ...staffFields.map(key => v[key]), row.revision, v.inUse ? 1 : 0)
  },
  write(row) {
    scope(row.destination, row.targetKind)
    const v = row.value as Record<string, any>
    if (v.id !== row.targetId || v.role !== 'staff' || v.active !== 0 || v.erased_at !== null || v.inUse !== false) throw new ImportError('invalid_import_effect', 409)
    return [
      sql('INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM l_erasure_journal WHERE identity_hash=?) THEN 1 ELSE 0 END', sha256(v.email)),
      sql(`INSERT INTO l_staff (${staffFields.join(',')}) VALUES (${staffFields.map(() => '?').join(',')})`, ...staffFields.map(key => v[key])),
      sql('INSERT INTO l_import_staff_revisions(staff_id,revision) VALUES(?,?)', row.targetId, row.revision),
      sql('UPDATE l_meta SET version=version+1 WHERE id=1'),
    ]
  },
  remove(dest, kind, id) {
    scope(dest, kind)
    return [
      sql(`INSERT INTO ik_d1_assertions(ok) SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM l_staff s WHERE s.id=? AND ${inUse}) THEN 1 ELSE 0 END`, id),
      sql('DELETE FROM l_import_staff_revisions WHERE staff_id=?', id),
      sql('DELETE FROM l_staff WHERE id=?', id),
      sql('UPDATE l_meta SET version=version+1 WHERE id=1'),
    ]
  },
  async list(db, dest) {
    if (dest !== destination) throw new ImportError('invalid_import_target', 409)
    return (await db.prepare(select).all()).results.map(target)
  },
  matchesCount(count, dest) {
    if (dest !== destination) throw new ImportError('invalid_import_target', 409)
    return sql('(SELECT COUNT(*) FROM l_staff)=?', count)
  },
  async preparePreservedUndo(db, dest, effects) {
    const rows = await this.list!(db, dest)
    return {
      observations: effects.map(effect => ({ effectId: effect.provenance.id,
        current: rows.find(row => row.targetId === effect.expected.targetId) ?? null,
        entity: { table: 'l_staff', recordId: effect.expected.targetId } })),
      dependencies: [],
      guards: [this.matchesCount!(rows.length, dest), ...rows.map(row => this.matches(row, dest, 'staff', row.targetId))],
    }
  },
}

export async function nativeConflicts(db: Pick<D1Database, 'prepare'>, values: Record<string, any>[]) {
  const conflicts: { staffId: string; reason: string }[] = []
  for (const value of values) {
    const erased = await db.prepare('SELECT 1 FROM l_erasure_journal WHERE identity_hash=?').bind(sha256(value.email)).first()
    if (erased) { conflicts.push({ staffId: value.id, reason: 'erased_identity' }); continue }
    const rows = await db.prepare('SELECT id FROM l_staff WHERE id=? OR email=? OR (payroll_id IS NOT NULL AND payroll_id=?)').bind(value.id, value.email, value.payroll_id).all()
    if (rows.results.length) conflicts.push({ staffId: value.id, reason: 'existing_staff_requires_review' })
  }
  return conflicts
}
