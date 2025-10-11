import type { FirstNonUndefined, Permission } from '../types';
import { permission } from '../utils/permission';

/**
 * Combine permissions with OR logic
 * Returns true if ANY permission allows access
 *
 * You can mix permissions with and without resources.
 * If at least one permission requires a resource, the result will require a resource.
 * If all permissions are context-only, the result will be context-only.
 *
 * Runs all permission checks in parallel for better performance.
 * This is especially beneficial with DataLoader, as all database
 * queries will be batched together.
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

export function or<TContext, TResource>(
  ...permissions: Permission<TContext, TResource>[]
): Permission<TContext, TResource> {
  return permission<TContext, TResource>(
    `(${permissions.map((p) => p.name).join(' OR ')})`,
    async (ctx, resource) => {
      // Run all permission checks in parallel
      const results = await Promise.all(
        permissions.map((p) => {
          // Always call with resource. If resource is undefined, it matches Permission<TContext, undefined>.
          const result = p.check(ctx, resource);
          return result instanceof Promise ? result : Promise.resolve(result);
        })
      );
      // Return true if any permission allows
      return results.some((allowed) => allowed);
    }
  );
}
