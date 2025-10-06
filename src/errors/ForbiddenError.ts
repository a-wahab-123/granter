import { PermissionError } from "./PermissionError";

/**
 * Error thrown when user is authenticated but lacks permission
 * HTTP Status: 403 Forbidden
 * 
 * @example
 * ```typescript
 * if (!await can(canDelete, ctx, post)) {
 *   throw new ForbiddenError('You cannot delete this post');
 * }
 * ```
 */
export class ForbiddenError extends PermissionError {
  constructor(message: string = 'Access forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}