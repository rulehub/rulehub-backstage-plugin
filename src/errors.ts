/** Error codes for RulehubClient operations
 * @public
 */
export const ERROR_CODES = {
  INDEX_HTTP_ERROR: 'INDEX_HTTP_ERROR',
  INDEX_SCHEMA_INVALID: 'INDEX_SCHEMA_INVALID',
  INDEX_ABORTED: 'INDEX_ABORTED',
  INDEX_UNKNOWN: 'INDEX_UNKNOWN',
} as const;

/** @public */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** @public */
export class RulehubError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: string;

  constructor(code: ErrorCode, message: string, details?: string) {
    super(message);
    this.name = 'RulehubError';
    this.code = code;
    this.details = details;
  }
}
