/**
 * Error thrown when authorization fails
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, PermissionError);
    }
  }
}
