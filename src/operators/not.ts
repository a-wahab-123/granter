import type { Permission } from '../types';
import { permission } from '../utils/permission';
import { checkWithExplain } from '../utils/explain';
import { now } from '../utils/performance';

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
  return permission<TContext, TResource>(`NOT ${p.name}`, async (ctx, resource, onExplain) => {
    const start = now();

    // Check child permission
    const check = await checkWithExplain(p, ctx, resource, onExplain);
    const finalResult = !check.result;

    // Call explain callback once for this NOT operation
    if (onExplain) {
      const duration = now() - start;
      onExplain({
        name: `NOT ${p.name}`,
        result: finalResult,
        duration: Math.round(duration * 100) / 100,
        operator: 'NOT',
        details: [check.detail],
      });
    }

    return finalResult;
  });
}
