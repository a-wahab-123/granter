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

export type AuthorizeOptions = { error?: string | Error | (() => Error) };

export async function authorize<TContext>(
  ctx: TContext,
  p: Permission<TContext>,
  resource?: undefined,
  options?: AuthorizeOptions
): Promise<void>;
export async function authorize<TContext, TResource>(
  ctx: TContext,
  p: Permission<TContext, TResource>,
  resource: TResource,
  options?: AuthorizeOptions
): Promise<void>;
export async function authorize<TContext, TResource = undefined>(
  ctx: TContext,
  p: Permission<TContext, TResource>,
  resource?: TResource,
  options?: AuthorizeOptions
): Promise<void> {
  if (!(await can(ctx, p, resource as TResource))) {
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
