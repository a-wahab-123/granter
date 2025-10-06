import type { Permission } from '../types';
import { permission } from '../utils/permission';

/**
 * Combine permissions with OR logic
 * Returns true if ANY permission allows access
 * 
 * Runs all permission checks in parallel for better performance.
 * This is especially beneficial with DataLoader, as all database
 * queries will be batched together.
 * 
 * @example
 * ```typescript
 * const canEdit = or(isOwner, isAdmin, isModerator);
 * ```
 */
export function or<TContext, T1>(
  p1: Permission<TContext, T1>
): Permission<TContext, T1>;
export function or<TContext, T1, T2>(
  p1: Permission<TContext, T1>,
  p2: Permission<TContext, T2>
): Permission<TContext, T1 | T2>;
export function or<TContext, T1, T2, T3>(
  p1: Permission<TContext, T1>,
  p2: Permission<TContext, T2>,
  p3: Permission<TContext, T3>
): Permission<TContext, T1 | T2 | T3>;
export function or<TContext, T1, T2, T3, T4>(
  p1: Permission<TContext, T1>,
  p2: Permission<TContext, T2>,
  p3: Permission<TContext, T3>,
  p4: Permission<TContext, T4>
): Permission<TContext, T1 | T2 | T3 | T4>;
export function or<TContext, T1, T2, T3, T4, T5>(
  p1: Permission<TContext, T1>,
  p2: Permission<TContext, T2>,
  p3: Permission<TContext, T3>,
  p4: Permission<TContext, T4>,
  p5: Permission<TContext, T5>
): Permission<TContext, T1 | T2 | T3 | T4 | T5>;
export function or<TContext>(...permissions: Permission<TContext, any>[]): Permission<TContext, any> {
  return permission(
    `(${permissions.map(p => p.name).join(' OR ')})`,
    async (ctx, resource) => {
      // Run all permission checks in parallel
      const results = await Promise.all(
        permissions.map(p => {
          const result = p.check(ctx, resource);
          return result instanceof Promise ? result : Promise.resolve(result);
        })
      );
      
      // Return true if any permission allows
      return results.some(allowed => allowed);
    }
  );
}