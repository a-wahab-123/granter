import type { FirstNonUndefined } from '../types';
import { type Permission } from '../utils/permission';
import { operatorPermission } from '../utils/operatorPermission';

/**
 * Combine permissions with OR logic
 * Returns true if ANY permission allows access
 *
 * You can mix permissions with and without resources.
 * If at least one permission requires a resource, the result will require a resource.
 * If all permissions are context-only, the result will be context-only.
 *
 * Checks permissions sequentially and short-circuits on first success.
 * This is more efficient when early checks are likely to succeed.
 * For DataLoader batching, use `orParallel()` instead.
 *
 * @example
 * ```typescript
 * // All permissions work on Post - returns Permission<Context, Post>
 * const canEdit = or(isOwner, isAdmin);
 *
 * // Mix resource and context-only - returns Permission<Context, Post>
 * const canView = or(isOwner, isPubliclyVisible, isAdmin);
 *
 * // All context-only - returns Permission<Context, undefined>
 * const isSpecialUser = or(isAdmin, isModerator);
 * ```
 */

// Overloads using computed types
export function or<TContext, TResource>(
  ...permissions: Permission<TContext, TResource>[]
): Permission<TContext, TResource>;

export function or<TContext, TResource1, TResource2>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>
): Permission<TContext, FirstNonUndefined<[TResource1, TResource2]>>;

export function or<TContext, TResource1, TResource2, TResource3>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>,
  p3: Permission<TContext, TResource3>
): Permission<TContext, FirstNonUndefined<[TResource1, TResource2, TResource3]>>;

export function or<TContext, TResource1, TResource2, TResource3, TResource4>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>,
  p3: Permission<TContext, TResource3>,
  p4: Permission<TContext, TResource4>
): Permission<TContext, FirstNonUndefined<[TResource1, TResource2, TResource3, TResource4]>>;

export function or<TContext, TResource1, TResource2, TResource3, TResource4, TResource5>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>,
  p3: Permission<TContext, TResource3>,
  p4: Permission<TContext, TResource4>,
  p5: Permission<TContext, TResource5>
): Permission<
  TContext,
  FirstNonUndefined<[TResource1, TResource2, TResource3, TResource4, TResource5]>
>;

export function or<
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

export function or<TContext, TResource = undefined>(
  ...permissions: Permission<TContext, TResource>[]
): Permission<TContext, TResource> {
  return operatorPermission<TContext, TResource>(
    'OR',
    permissions,
    async (ctx: TContext, resource: TResource) => {
      // Check permissions sequentially with short-circuit
      for (const p of permissions) {
        const result = await p(ctx, ...((resource !== undefined ? [resource] : []) as any));
        if (result) {
          return true;
        }
      }
      return false;
    }
  );
}
