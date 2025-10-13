import type { FirstNonUndefined } from '../types';
import { type Permission } from '../utils/permission';
import { operatorPermission } from '../utils/operatorPermission';

/**
 * Combine permissions with AND logic
 * Returns true only if ALL permissions allow access
 *
 * All permissions must work on the same resource type for type safety.
 * This prevents accidentally mixing incompatible permission checks.
 *
 * Runs checks sequentially and stops at the first failure for efficiency.
 * Order your permissions from cheapest to most expensive.
 *
 * @example
 * ```typescript
 * // ✅ All permissions work on same resource type
 * const canPublish = and(isAuthenticated, isOwner, hasVerifiedEmail);
 *
 * // ❌ TypeScript error - mixing incompatible types
 * const mixed = and(isPostOwner, isCommentOwner);
 * ```
 */

export function and<TContext, TResource>(
  ...permissions: Permission<TContext, TResource>[]
): Permission<TContext, TResource>;

export function and<TContext, TResource1, TResource2>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>
): Permission<TContext, FirstNonUndefined<[TResource1, TResource2]>>;

export function and<TContext, TResource1, TResource2, TResource3>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>,
  p3: Permission<TContext, TResource3>
): Permission<TContext, FirstNonUndefined<[TResource1, TResource2, TResource3]>>;

export function and<TContext, TResource1, TResource2, TResource3, TResource4>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>,
  p3: Permission<TContext, TResource3>,
  p4: Permission<TContext, TResource4>
): Permission<TContext, FirstNonUndefined<[TResource1, TResource2, TResource3, TResource4]>>;

export function and<TContext, TResource1, TResource2, TResource3, TResource4, TResource5>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>,
  p3: Permission<TContext, TResource3>,
  p4: Permission<TContext, TResource4>,
  p5: Permission<TContext, TResource5>
): Permission<
  TContext,
  FirstNonUndefined<[TResource1, TResource2, TResource3, TResource4, TResource5]>
>;

export function and<
  TContext,
  TResource1,
  TResource2,
  TResource3,
  TResource4,
  TResource5,
  TResource6,
>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>,
  p3: Permission<TContext, TResource3>,
  p4: Permission<TContext, TResource4>,
  p5: Permission<TContext, TResource5>,
  p6: Permission<TContext, TResource6>
): Permission<
  TContext,
  FirstNonUndefined<[TResource1, TResource2, TResource3, TResource4, TResource5, TResource6]>
>;

export function and<TContext, TResource>(
  ...permissions: Permission<TContext, TResource>[]
): Permission<TContext, TResource> {
  return operatorPermission<TContext, TResource>(
    'AND',
    permissions,
    async (ctx: TContext, resource: TResource) => {
      // Check permissions sequentially with short-circuit
      for (const p of permissions) {
        const result = await p(ctx, resource);
        if (!result) {
          return false;
        }
      }
      return true;
    }
  );
}
