import type { Permission, PermissionCheck } from '../types';

/**
 * Create a new permission
 *
 * @example
 * ```typescript
 * const isAdmin = permission('isAdmin',
 *   (ctx) => ctx.user.role === 'admin'
 * );
 * ```
 */
export function permission<TContext>(
  name: string,
  check: PermissionCheck<TContext>
): Permission<TContext>;
export function permission<TContext, TResource>(
  name: string,
  check: PermissionCheck<TContext, TResource>
): Permission<TContext, TResource>;
export function permission<TContext, TResource = undefined>(
  name: string,
  check: PermissionCheck<TContext, TResource>
): Permission<TContext, TResource> {
  return { name, check };
}
