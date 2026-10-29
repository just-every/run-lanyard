import type {JsonSchema} from '../../modules/agent-door/index.ts'
export const string = {type: 'string'} as const
export const object = (properties: Record<string, JsonSchema>, required = Object.keys(properties)) => ({type: 'object' as const, properties, required, additionalProperties: false})
export const output = {type: 'object', properties: {ok: {type: 'boolean'}, result: {type: 'object'}, version: {type: 'integer'}}, required: ['ok','result','version'], additionalProperties: false}
export const inputs = {
 roster: object({week: string, shifts: {type: 'array', minItems: 1, maxItems: 250, items: object({staffId: string, start: string, end: string, breakMinutes: {type: 'integer', minimum: 0, maximum: 1440}, label: string, site: string, job: string}, ['staffId','start','end','breakMinutes'])}}),
 time: object({staffId: string, start: string, end: string, breakMinutes: {type: 'integer', minimum: 0, maximum: 1440}, reason: string, corrects: string, job: string, site: string}, ['staffId','start','end','breakMinutes','reason']),
 payroll: object({ids: {type: 'array', minItems: 1, maxItems: 500, items: string}, templateId: string}, []),
 comparison: object({site: string, week: string, weeks: {type: 'integer', minimum: 1, maximum: 26}}, ['site','week']),
 demand: object({site: string, date: string}),
 learning: object({site: string, weeks: {type: 'integer', minimum: 1, maximum: 26}}, ['site']),
 propose: object({site: string, weeks: {type: 'integer', minimum: 1, maximum: 26}, digest: string}),
}
