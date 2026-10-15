export class ImportError extends Error {
  constructor(public code: string, public status: number, message = code) { super(message); this.name = 'ImportError' }
}
export function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new ImportError(`invalid_${field}`, 400)
  return value
}
