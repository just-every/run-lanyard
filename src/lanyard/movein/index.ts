import {
  planD1Import, createD1ImportJob, applyD1ImportBatches, undoD1Import, resumeD1Import,
  readD1ImportJob, readD1ImportOriginals, rollbackD1Import,
} from '../../modules/import-kit/src/d1/index.ts'
import type { D1ImportContext, D1Database as KitDatabase, D1Sql, D1TargetAdapter, ImportMapping, ImportPlan } from '../../modules/import-kit/src/d1/index.ts'
import { namespace, staffSource } from './csv'
import { destination, mappingVersion, staffTargets, nativeConflicts } from './targets'
import { ImportError, requiredText } from './errors'
export { ImportError } from './errors'
export type ImportActor = { id: string; email: string; role: string }

// Each staff record an import action creates or removes leaves an activity event in the same atomic kit batch.
function auditedTargets(actor: ImportActor, action: string): D1TargetAdapter {
  const event = (staffId: string): D1Sql => ({ sql: 'INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)', params: [crypto.randomUUID(), actor.id, actor.role, action, staffId, new Date().toISOString()] })
  return { ...staffTargets, write: row => [...staffTargets.write(row), event(row.targetId)], remove: (dest, kind, id) => [...staffTargets.remove(dest, kind, id), event(id)] }
}

export function importContext(db: D1Database, actor: ImportActor, action = 'import.read'): D1ImportContext {
  if (actor.role !== 'owner') throw new ImportError('owner_required', 403)
  return {
    destination, namespace, mappingVersion, storage: { database: db as unknown as KitDatabase, targets: auditedTargets(actor, action) },
    batchSize: 10, maxBatches: 1, reversalPolicy: 'preserve-conflicts',
    authorization: { principalId: actor.id, predicate: () => ({
      sql: "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')",
      params: [actor.id],
    }) },
  }
}
const mapping: ImportMapping = {
  version: mappingVersion,
  map(record) {
    return { effects: [{ targetKind: 'staff', targetId: record.sourceId,
      value: { ...(record.payload as Record<string, string | null>), role: 'staff', active: 0, version: 1, erased_at: null, inUse: false } }] }
  },
}
const staffValues = (plan: ImportPlan) => plan.entries.flatMap(entry => entry.effects.map(effect => effect.value as Record<string, any>))

/** Caller authenticates the request and checks its origin; every kit batch rechecks the active owner. */
export async function importCommand(db: D1Database, actor: ImportActor, name: string, input: Record<string, unknown>): Promise<unknown> {
  const context = importContext(db, actor, name)
  // Friendly 403 before parsing input; SQL predicates also fence every kit publication.
  const owner = await db.prepare("SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active'").bind(actor.id).first()
  if (!owner) throw new ImportError('owner_required', 403)
  try {
    if (name === 'import.preview' || name === 'import.apply') {
      const plan = await planD1Import(staffSource(input.csv), mapping, context)
      if (name === 'import.preview') return {
        fingerprint: plan.fingerprint, counts: plan.counts, diagnostics: plan.diagnostics,
        staff: staffValues(plan), conflicts: await nativeConflicts(db, staffValues(plan)),
      }
      const reviewedFingerprint = requiredText(input.fingerprint, 'fingerprint')
      if (reviewedFingerprint !== plan.fingerprint) throw new ImportError('review_fingerprint_mismatch', 409, 'Preview this exact CSV again before applying')
      // Erasure checks happen before journal creation and again inside each native write.
      const conflicts = await nativeConflicts(db, staffValues(plan))
      if (conflicts.some(c => c.reason === 'erased_identity')) throw new ImportError('erased_identity', 409, 'An erased staff identity cannot be imported again')
      const job = await createD1ImportJob(plan, { ...context, reviewedFingerprint })
      return { job: await applyD1ImportBatches(job.id, context) }
    }
    const jobId = requiredText(input.jobId, 'jobId')
    if (name === 'import.rollback') return { job: await rollbackD1Import(jobId, context) }
    if (name === 'import.undo') return { job: await undoD1Import(jobId, context) }
    if (name === 'import.resume') return { job: await resumeD1Import(jobId, context) }
    if (name === 'import.journal') {
      const job = await readD1ImportJob(jobId, context)
      const originals = await readD1ImportOriginals(jobId, context)
      const { results: batches } = await db.prepare('SELECT action,position,end_position,fence FROM ik_batches WHERE job_id=? ORDER BY rowid').bind(jobId).all()
      await readD1ImportJob(jobId, context)
      return { job, originals, batches }
    }
    throw new ImportError('unknown_import_command', 400)
  } catch (error) {
    if (error instanceof ImportError) throw error
    const message = error instanceof Error ? error.message : ''
    if (message.includes('IMPORT_JOB_NOT_FOUND')) throw new ImportError('import_job_not_found', 404)
    if (/NATIVE_EDIT_CONFLICT|TARGET_REVISION_CONFLICT|SOURCE_ID_CONTENT_CONFLICT|IMPORT_ALREADY_REVERSING|IMPORT_ATOMIC_GUARD|IMPORT_FINAL_GUARD|JOB_BINDING_MISMATCH|OPERATION_KEY_CONFLICT|UNIQUE constraint|IMPORT_NOT_COMPLETED|IMPORT_NOT_COMPLETE|UNDO_REQUIRES|REVERSAL_MODE_CONFLICT/.test(message)) {
      throw new ImportError('import_conflict', 409, 'Import conflicts with current records or authority. Review the journal; later edits and dependent work are preserved.')
    }
    if (/IMPORT_D1_REQUEST_LIMIT|IMPORT_D1_TRANSPORT_LIMIT/.test(message)) throw new ImportError('import_request_limit', 409, 'Resume this import in a new request')
    throw error
  }
}
