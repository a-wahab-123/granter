import { type Permission } from '../utils/permission';
import { operatorPermission } from '../utils/operatorPermission';

/**
 * Negate a permission
 *
 * @example
 * ```typescript
 * const isNotBanned = not(isBanned);
 * const canComment = and(isAuthenticated, not(isBanned));
 * ```
 */
export function not<TContext, TResource>(
  p: Permission<TContext, TResource>
): Permission<TContext, TResource> {
  return operatorPermission<TContext, TResource>(
    'NOT',
    [p],
    async (ctx: TContext, resource: TResource) => {
      const result = await p(ctx, ...(resource !== undefined ? [resource] : []) as any);
      return !result;
    }
  );
}
