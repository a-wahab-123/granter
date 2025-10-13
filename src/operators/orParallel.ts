import type { FirstNonUndefined } from '../types';
import { type Permission } from '../utils/permission';
import { operatorPermission } from '../utils/operatorPermission';

/**
 * Combine permissions with OR logic (parallel execution)
 * Returns true if ANY permission allows access
 *
 * Runs all permission checks in parallel, even if an early check succeeds.
 * This is beneficial for DataLoader batching, as all database queries
 * will be batched together in a single tick.
 *
 * Use the regular `or()` for sequential short-circuit behavior.
 *
 * @example
 * ```typescript
 * // With DataLoader - all checks run in parallel and batch DB queries
 * const canEdit = orParallel(isOwner, isAdmin, isModerator);
 * 
 * // Even if isOwner succeeds, isAdmin and isModerator still execute
 * // allowing DataLoader to batch all user/permission lookups
 * ```
 */

// Overloads using computed types
export function orParallel<TContext, TResource>(
  ...permissions: Permission<TContext, TResource>[]
): Permission<TContext, TResource>;

export function orParallel<TContext, TResource1, TResource2>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>
): Permission<TContext, FirstNonUndefined<[TResource1, TResource2]>>;

export function orParallel<TContext, TResource1, TResource2, TResource3>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>,
  p3: Permission<TContext, TResource3>
): Permission<TContext, FirstNonUndefined<[TResource1, TResource2, TResource3]>>;

export function orParallel<TContext, TResource1, TResource2, TResource3, TResource4>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>,
  p3: Permission<TContext, TResource3>,
  p4: Permission<TContext, TResource4>
): Permission<TContext, FirstNonUndefined<[TResource1, TResource2, TResource3, TResource4]>>;

export function orParallel<TContext, TResource1, TResource2, TResource3, TResource4, TResource5>(
  p1: Permission<TContext, TResource1>,
  p2: Permission<TContext, TResource2>,
  p3: Permission<TContext, TResource3>,
  p4: Permission<TContext, TResource4>,
  p5: Permission<TContext, TResource5>
): Permission<
  TContext,
  FirstNonUndefined<[TResource1, TResource2, TResource3, TResource4, TResource5]>
>;

export function orParallel<
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

export function orParallel<TContext, TResource = undefined>(
  ...permissions: Permission<TContext, TResource>[]
): Permission<TContext, TResource> {
  return operatorPermission<TContext, TResource>(
    'OR',
    permissions,
    async (ctx: TContext, resource: TResource) => {
      // Run all checks in parallel (no short-circuit)
      const results = await Promise.all(
        permissions.map((p) => p(ctx, ...(resource !== undefined ? [resource] : []) as any))
      );
      return results.some((result) => result);
    },
  );
}

