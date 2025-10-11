import type { Permission } from '../types';
import { permission } from '../utils/permission';

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
  return permission<TContext, TResource>(`NOT ${p.name}`, async (ctx, resource) => {
    const result = p.check(ctx, resource);
    const allowed = result instanceof Promise ? await result : result;
    return !allowed;
  });
}
