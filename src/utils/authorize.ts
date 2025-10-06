import type { Permission } from '../types';
import { ForbiddenError } from '../errors';
import { can } from './can';


/**
 * Require a permission or throw an error
 * Useful for protecting routes/endpoints
 * 
 * @throws {PermissionError} If permission is denied
 * 
 * @example
 * ```typescript
 * await authorize(canDelete, ctx, post);
 * // If we reach here, user is authorized
 * await deletePost(post);
 * ```
 */
export async function authorize<TContext, TResource>(
  ctx: TContext,
  p: Permission<TContext, TResource>,
  resource?: TResource,
  options?: { error?: string | Error | (() => Error) }
): Promise<void> {
  if (!await can(ctx, p, resource)) {
    const error = options?.error;
    
    if (!error) {
      throw new ForbiddenError(`Permission denied: ${p.name}`);
    }
    
    if (typeof error === 'string') {
      throw new ForbiddenError(error);
    }
    
    if (typeof error === 'function') {
      throw error();
    }
    
    throw error;
  }
}