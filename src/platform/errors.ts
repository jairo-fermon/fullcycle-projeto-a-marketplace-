export class AppError extends Error {
  constructor(public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'UNAVAILABLE', message: string) { super(message); }
}
export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AppError('INVALID_INPUT', message);
}
