import { PermissionError } from './PermissionError';

/**
 * Error thrown when user is not authenticated
 * HTTP Status: 401 Unauthorized
 *
 * @example
 * ```typescript
 * if (!ctx.user) {
 *   throw new UnauthorizedError('Please log in');
 * }
 * ```
 */
export class UnauthorizedError extends PermissionError {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
